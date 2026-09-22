import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import {
  Shield,
  CheckCircle2,
  Circle,
  QrCode,
  ArrowLeft,
  MapPin,
  Camera,
  Check,
  Award
} from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const PatrolTourScreen = ({ onBack }) => {
  const {
    sites,
    activeShiftSession,
    activePatrolSession,
    startPatrol,
    scanCheckpoint,
    completePatrol,
    currentUser
  } = useSecurity();

  const assignedSiteId = activeShiftSession?.siteId || currentUser.assignedSiteId || 'site-1';
  const site = sites.find((s) => s.id === assignedSiteId) || sites[0];
  const checkpoints = site?.requiredCheckpoints || [];

  const [activeSession, setActiveSession] = useState(activePatrolSession);

  // If no patrol session started yet, initialize or provide start action
  const handleStartPatrol = () => {
    const session = startPatrol(site.id);
    setActiveSession(session);
  };

  const handleScan = (checkpoint) => {
    scanCheckpoint(checkpoint.id, {
      gpsAccuracy: '3.2m',
      photoVerified: true,
      timestamp: new Date().toISOString()
    });
  };

  const scannedIds = activePatrolSession?.scannedCheckpoints?.map((c) => c.checkpointId) || [];
  const completedCount = scannedIds.length;
  const totalCount = checkpoints.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isTourComplete = totalCount > 0 && completedCount >= totalCount;

  const handleFinishTour = () => {
    completePatrol();
    Alert.alert(
      'Patrol Tour Cleared!',
      `All ${totalCount} security checkpoints verified with GPS coordinates. Shift log submitted to command dispatch.`,
      [{ text: 'Great Job', onPress: onBack }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft color="#94a3b8" size={20} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Active Patrol Tour</Text>
          <Text style={styles.headerSubtitle}>{site.name}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {activePatrolSession ? 'IN PROGRESS' : 'READY'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>Inspection Route Status</Text>
              <Text style={styles.progressStats}>
                {completedCount} of {totalCount} Checkpoints Verified
              </Text>
            </View>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>

          {/* Bar */}
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {!activePatrolSession && (
          <View style={styles.startCard}>
            <Shield color="#38bdf8" size={32} />
            <Text style={styles.startCardTitle}>Ready to begin tour route</Text>
            <Text style={styles.startCardSubtitle}>
              Walk the designated inspection perimeter and scan each physical NFC / QR barcode checkpoint.
            </Text>
            <TouchableOpacity onPress={handleStartPatrol} style={styles.startTourButton}>
              <Text style={styles.startTourButtonText}>INITIALIZE PATROL TOUR</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Checkpoint Cards */}
        <Text style={styles.sectionHeader}>Designated Waypoints</Text>
        {checkpoints.map((cp, idx) => {
          const isScanned = scannedIds.includes(cp.id);

          return (
            <View
              key={cp.id}
              style={[
                styles.checkpointCard,
                isScanned && styles.checkpointCardScanned
              ]}
            >
              <View style={styles.cpTopRow}>
                <View style={styles.cpNumberBadge}>
                  <Text style={styles.cpNumberText}>#{idx + 1}</Text>
                </View>
                <View style={styles.cpInfo}>
                  <Text style={styles.cpName}>{cp.name}</Text>
                  <Text style={styles.cpDesc}>{cp.description}</Text>
                </View>
                {isScanned ? (
                  <CheckCircle2 color="#10b981" size={24} />
                ) : (
                  <Circle color="#64748b" size={24} />
                )}
              </View>

              <View style={styles.cpFooter}>
                <View style={styles.cpReqRow}>
                  <MapPin color="#64748b" size={13} />
                  <Text style={styles.cpReqText}>GPS Geofence Match</Text>
                </View>

                {isScanned ? (
                  <View style={styles.verifiedBadge}>
                    <Check color="#10b981" size={13} />
                    <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    disabled={!activePatrolSession}
                    onPress={() => handleScan(cp)}
                    style={[
                      styles.scanButton,
                      !activePatrolSession && styles.scanButtonDisabled
                    ]}
                  >
                    <QrCode color="#ffffff" size={14} />
                    <Text style={styles.scanButtonText}>SCAN CHECKPOINT</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Submit Patrol Tour Button */}
        {activePatrolSession && (
          <TouchableOpacity
            disabled={!isTourComplete}
            onPress={handleFinishTour}
            style={[
              styles.completeTourButton,
              !isTourComplete && styles.completeTourButtonDisabled
            ]}
          >
            <Award color="#ffffff" size={20} />
            <Text style={styles.completeTourButtonText}>
              {isTourComplete
                ? 'SUBMIT COMPLETED PATROL TOUR'
                : `SCAN ALL CHECKPOINTS (${completedCount}/${totalCount})`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a'
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b'
  },
  headerCenter: {
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  statusPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8'
  },
  content: {
    flex: 1,
    padding: 16
  },
  progressCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc'
  },
  progressStats: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  progressPercentText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10b981'
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4
  },
  startCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0284c7',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20
  },
  startCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 10,
    marginBottom: 4
  },
  startCardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  startTourButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center'
  },
  startTourButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  checkpointCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 12
  },
  checkpointCardScanned: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)'
  },
  cpTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  cpNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cpNumberText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800'
  },
  cpInfo: {
    flex: 1
  },
  cpName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  cpDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  cpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10
  },
  cpReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  cpReqText: {
    fontSize: 11,
    color: '#64748b'
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  verifiedBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800'
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  scanButtonDisabled: {
    opacity: 0.5
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  completeTourButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 16,
    marginVertical: 20
  },
  completeTourButtonDisabled: {
    backgroundColor: '#1e293b'
  },
  completeTourButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5
  }
});
