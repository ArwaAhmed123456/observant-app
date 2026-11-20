require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { Site, Alert } = require('./src/models');

async function updateSiteLocation() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Exact coordinates from Google Earth screenshot:
  // 52°56'53.67"N -> 52 + 56/60 + 53.67/3600 = 52.948242
  // 2°00'22.12"W  -> -(2 + 0/60 + 22.12/3600) = -2.006144
  // Elevation: 182.89 m
  const lat = 52.948242;
  const lng = -2.006144;
  const elevation = 182.89;
  const radius = 1000; // 1000 metres covers the entire solar farm layout

  const site = await Site.findByIdAndUpdate(
    '6aef099c741e8672af1fa0b3',
    {
      $set: {
        latitude: lat,
        longitude: lng,
        'location.type': 'Point',
        'location.coordinates': [lng, lat],
        geofenceRadiusMetres: radius,
        notes: `Google Earth Location: 52°56'53.67"N 2°00'22.12"W (Elevation: ${elevation}m)`
      }
    },
    { new: true }
  );

  console.log('Updated Totmonslow Solar Farm Site:', {
    id: site._id,
    name: site.name,
    latitude: site.latitude,
    longitude: site.longitude,
    location: site.location,
    geofenceRadiusMetres: site.geofenceRadiusMetres,
    notes: site.notes
  });

  // Also clean up any past out_of_bounds alerts that were caused by the Birmingham coordinate mismatch
  const delAlerts = await Alert.deleteMany({
    type: 'out_of_bounds',
    siteId: '6aef099c741e8672af1fa0b3'
  });
  console.log(`Cleaned up ${delAlerts.deletedCount} old out_of_bounds alerts caused by old coordinates.`);

  await mongoose.disconnect();
}

updateSiteLocation().catch(console.error);
