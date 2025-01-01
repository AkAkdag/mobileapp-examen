import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export default function App() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
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
        <Text>Camera toestemming is vereist om door te gaan.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
          <Text style={styles.permissionText}>Geef toestemming</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openCamera = () => setIsCameraOpen(true);
  const closeCamera = () => setIsCameraOpen(false);

  const fetchLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Toestemming geweigerd', 'Locatietoestemming is vereist om GPS-gegevens op te halen.');
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

      Alert.alert('Lokaal opgeslagen!', `Foto en metadata opgeslagen in ${PHOTO_FOLDER}`);
    } catch (error) {
      console.error('Fout bij het opslaan van foto en metadata:', error);
      Alert.alert('Fout', 'Kon de foto en metadata niet opslaan.');
    }
  };

  const generateAndSharePDF = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(PHOTO_FOLDER);
      const photoFiles = files.filter((file) => file.startsWith('photo_') && file.endsWith('.jpg'));

      if (photoFiles.length === 0) {
        Alert.alert('Geen foto gevonden', 'Er zijn geen foto’s opgeslagen om in de PDF op te nemen.');
        return;
      }

      // Sort photo files by timestamp (extract timestamp from filename)
      const sortedPhotoFiles = photoFiles.sort((a, b) => {
        const timeA = parseInt(a.split('_')[1].split('.')[0]); // Extract timestamp from filename
        const timeB = parseInt(b.split('_')[1].split('.')[0]); // Extract timestamp from filename
        return timeB - timeA; // Sort descending (latest photo first)
      });

      const latestPhotoFile = sortedPhotoFiles[0];
      const photoPath = `${PHOTO_FOLDER}/${latestPhotoFile}`;

      // Convert the photo to Base64
      const base64Image = await FileSystem.readAsStringAsync(photoPath, { encoding: FileSystem.EncodingType.Base64 });
      const photoBase64URI = `data:image/jpeg;base64,${base64Image}`;

      // Generate the PDF content
      const html = `
        <html>
          <body>
            <h1>Foto Metadata</h1>
            <p><strong>Beschrijving:</strong> ${description || 'N.V.T.'}</p>
            <p><strong>Locatie:</strong> ${location || 'N.V.T.'}</p>
            <p><strong>Categorie:</strong> ${category || 'N.V.T.'}</p>
            <p><strong>Tijdstip:</strong> ${new Date().toISOString()}</p>
            <h2>Foto:</h2>
            <img src="${photoBase64URI}" style="width: 100%; max-width: 400px; height: auto;" />
          </body>
        </html>
      `;

      // Generate the PDF
      const { uri } = await Print.printToFileAsync({ html });
      const pdfPath = `${PHOTO_FOLDER}/metadata_${Date.now()}.pdf`;
      await FileSystem.moveAsync({
        from: uri,
        to: pdfPath,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfPath);
      } else {
        Alert.alert('Delen niet beschikbaar', 'Het delen van bestanden is niet beschikbaar op dit apparaat.');
      }
    } catch (error) {
      console.error('Fout bij het genereren of delen van PDF:', error);
      Alert.alert('Fout', 'Kan de PDF niet genereren of delen.');
    }
  };

  const takePic = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();

        if (!photo || !photo.uri) {
          Alert.alert('Fout', 'Kon geen foto maken. Probeer het opnieuw.');
          return;
        }

        savePhotoAndMetadata(photo.uri);
        closeCamera();
      } catch (error) {
        console.error(error);
        Alert.alert('Fout', 'Kon de foto niet maken of opslaan.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {!isCameraOpen ? (
        <View style={styles.layout}>
          <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
            <Text style={styles.cameraButtonText}>Camera openen</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Voer beschrijving in"
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
            <Text style={styles.buttonText}>PDF genereren en delen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <CameraView style={styles.camera} type={facing} ref={cameraRef}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.photoButton} onPress={takePic}>
              <Text style={styles.buttonText}>Foto maken</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={closeCamera}>
              <Text style={styles.buttonText}>Camera sluiten</Text>
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
  permissionButton: { marginVertical: 20, padding: 15, backgroundColor: '#FF3B30', borderRadius: 10, width: '80%', alignItems: 'center' },
  permissionText: { color: '#fff', fontSize: 16 },
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