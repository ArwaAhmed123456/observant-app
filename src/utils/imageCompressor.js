import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image to max width 1200px with 0.60 JPEG compression.
 * Reduces 10-20MB phone camera shots down to ~120-180KB for instantaneous upload.
 */
export async function compressImageForUpload(photoUri) {
  if (!photoUri) return null;
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri || photoUri;
  } catch (error) {
    console.warn('Image compression fallback to original photoUri:', error);
    return photoUri;
  }
}
