import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export default function App() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [category, setCategory] = useState('Grondkabels');
  const cameraRef = useRef<CameraView | null>(null);

  const PHOTO_FOLDER = `${FileSystem.documentDirectory}MyAppPhotos`;

  useEffect(() => {
    const createPhotoFolder = async () => {
      const folderInfo = await FileSystem.getInfoAsync(PHOTO_FOLDER);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(PHOTO_FOLDER, { intermediates: true });
      }
    };

    createPhotoFolder();
  }, []);

  if (!cameraPermission) {
    return <View />;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Text>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestCameraPermission}>
          <Text>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openCamera = () => setIsCameraOpen(true);
  const closeCamera = () => setIsCameraOpen(false);

  const fetchLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to fetch GPS data');
      return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    setLocation(`Lat: ${loc.coords.latitude}, Long: ${loc.coords.longitude}`);
  };

  const savePhotoAndMetadata = async (photoUri: string) => {
    const metadata = {
      photoUri,
      description,
      location,
      category,
      timestamp: new Date().toISOString(),
    };

    try {
      const photoFilename = `${PHOTO_FOLDER}/photo_${Date.now()}.jpg`;
      await FileSystem.moveAsync({
        from: photoUri,
        to: photoFilename,
      });

      const metadataFilename = `${PHOTO_FOLDER}/metadata_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(metadataFilename, JSON.stringify(metadata));

      Alert.alert('Saved Locally!', `Photo and metadata saved in ${PHOTO_FOLDER}`);
    } catch (error) {
      console.error('Error saving photo and metadata:', error);
      Alert.alert('Error', 'Failed to save the photo and metadata.');
    }
  };

  const generateAndSharePDF = async () => {
    try {
      // Get the list of files in the photo folder
      const files = await FileSystem.readDirectoryAsync(PHOTO_FOLDER);
      const photoFile = files.find((file) => file.startsWith('photo_') && file.endsWith('.jpg'));
  
      if (!photoFile) {
        Alert.alert('No Photo Found', 'There are no photos saved to include in the PDF.');
        return;
      }
  
      // Get the full path of the photo
      const photoPath = `${PHOTO_FOLDER}/${photoFile}`;
  
      // Convert photo to Base64
      const base64Image = await FileSystem.readAsStringAsync(photoPath, { encoding: FileSystem.EncodingType.Base64 });
      const photoBase64URI = `data:image/jpeg;base64,${base64Image}`;
  
      // Generate PDF content with photo and metadata
      const html = `
        <html>
          <body>
            <h1>Photo Metadata</h1>
            <p><strong>Description:</strong> ${description || 'N/A'}</p>
            <p><strong>Location:</strong> ${location || 'N/A'}</p>
            <p><strong>Category:</strong> ${category || 'N/A'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <h2>Photo:</h2>
            <img src="${photoBase64URI}" style="width: 100%; max-width: 400px; height: auto;" />
          </body>
        </html>
      `;
  
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });
      console.log('PDF generated:', uri);
  
      // Move PDF to a known location
      const pdfPath = `${PHOTO_FOLDER}/metadata_${Date.now()}.pdf`;
      await FileSystem.moveAsync({
        from: uri,
        to: pdfPath,
      });
  
      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfPath);
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Error generating or sharing PDF:', error);
      Alert.alert('Error', 'Failed to generate or share the PDF.');
    }
  };

  const takePic = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();

        if (!photo || !photo.uri) {
          Alert.alert('Error', 'Failed to capture photo. Please try again.');
          return;
        }

        savePhotoAndMetadata(photo.uri);
        closeCamera();
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to take or save the photo.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {!isCameraOpen ? (
        <View style={styles.layout}>
          <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
            <Text style={styles.cameraButtonText}>Camera</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Beschrijving Veld"
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity style={styles.locationButton} onPress={fetchLocation}>
            <Text style={styles.locationText}>{location || 'GPS-locatie ophalen'}</Text>
          </TouchableOpacity>
          <View style={styles.categoryMenu}>
            <Text style={styles.categoryLabel}>Categorie:</Text>
            <TextInput
              style={styles.categoryInput}
              value={category}
              onChangeText={setCategory}
              placeholder="Selecteer een categorie"
            />
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={generateAndSharePDF}>
            <Text style={styles.buttonText}>Generate and Share PDF</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <CameraView style={styles.camera} type={facing} ref={cameraRef}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.photoButton} onPress={takePic}>
              <Text style={styles.buttonText}>Take Picture</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={closeCamera}>
              <Text style={styles.buttonText}>Close Camera</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  layout: { width: '90%', alignItems: 'center' },
  cameraButton: { marginVertical: 20, padding: 15, backgroundColor: '#007AFF', borderRadius: 10, width: '80%', alignItems: 'center' },
  cameraButtonText: { color: '#fff', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, width: '100%', marginVertical: 10, borderRadius: 5 },
  locationButton: { backgroundColor: '#f0f0f0', padding: 10, width: '100%', marginVertical: 10, alignItems: 'center', borderRadius: 5 },
  locationText: { fontSize: 14 },
  categoryMenu: { width: '100%', marginVertical: 10 },
  categoryLabel: { fontSize: 14, marginBottom: 5 },
  categoryInput: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5 },
  saveButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, marginVertical: 10, alignItems: 'center' },
  camera: { flex: 1, width: '100%' },
  cameraControls: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  photoButton: { backgroundColor: '#007AFF', padding: 20, borderRadius: 50, marginBottom: 20 },
  closeButton: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 10, marginBottom: 20 },
});