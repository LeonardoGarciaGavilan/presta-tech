import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export default async function compressImage(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.75, format: SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    throw new Error('No se pudo comprimir la imagen. Intente con otra foto.');
  }
}
