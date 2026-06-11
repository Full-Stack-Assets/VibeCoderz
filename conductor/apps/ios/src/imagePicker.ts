/**
 * Image attachment helpers built on expo-image-picker.
 *
 * Returns ready-to-send `Attachment`s with a base64 data URL (what the backend
 * forwards to vision models). Everything is wrapped so a denied permission or a
 * picker error surfaces as a friendly Alert instead of crashing the turn.
 * Images are downscaled/compressed to keep base64 payloads (and memory) sane.
 */
import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { Attachment } from './types'

export const MAX_ATTACHMENTS = 4
const QUALITY = 0.5

let counter = 0
const attId = () => `att-${Date.now().toString(36)}-${(counter++).toString(36)}`

function toAttachments(assets: ImagePicker.ImagePickerAsset[]): Attachment[] {
  const out: Attachment[] = []
  for (const a of assets) {
    if (!a.base64) continue
    const mediaType = a.mimeType || 'image/jpeg'
    out.push({
      id: attId(),
      kind: 'image',
      name: a.fileName || `image-${out.length + 1}.jpg`,
      mediaType,
      dataUrl: `data:${mediaType};base64,${a.base64}`,
      width: a.width,
      height: a.height,
    })
  }
  return out
}

/** Pick up to `remaining` images from the library. Returns [] if cancelled. */
export async function pickImages(remaining = MAX_ATTACHMENTS): Promise<Attachment[]> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Enable photo library access in Settings to attach images.')
      return []
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: QUALITY,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, remaining),
    })
    if (result.canceled) return []
    return toAttachments(result.assets).slice(0, Math.max(1, remaining))
  } catch (e) {
    Alert.alert('Could not attach image', (e as Error)?.message ?? 'Unknown error')
    return []
  }
}

/** Capture a photo with the camera. Returns [] if cancelled or unavailable. */
export async function takePhoto(): Promise<Attachment[]> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to take a photo.')
      return []
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: QUALITY })
    if (result.canceled) return []
    return toAttachments(result.assets)
  } catch (e) {
    Alert.alert('Could not take photo', (e as Error)?.message ?? 'Unknown error')
    return []
  }
}
