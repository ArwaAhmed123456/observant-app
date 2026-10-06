import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image to max width 1024px with 0.65 JPEG compression.
 * Reduces 10-20MB phone camera shots down to ~120-180KB for instantaneous upload.
 */
export async function compressImageForUpload(photoUri) {
  if (!photoUri) return null;
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    console.warn('Image compression fallback to original photoUri:', error);
    return photoUri;
  }
}
