import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { StyleSheet, Text,  View, Button  } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export default function App() {
  const [ {x, y, z}, setData ] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    const subscription = Accelerometer.addListener(setData);
    return () => subscription.remove();
  },[])

  return(
    <View style={styles.container}>
      <Text>x: {x}</Text>
      <Text>y: {y}</Text>
      <Text>z: {z}</Text>
      <Button  title='Langzaam' onPress={() => Accelerometer.setUpdateInterval(2000)} />
      <Button  title='Snel' onPress={() => Accelerometer.setUpdateInterval(50)} />

      <StatusBar style='auto' />
    </View>
  );
 
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

 
  
});