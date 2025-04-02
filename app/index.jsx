/* Index is home page */

import { Text, View, StyleSheet } from "react-native";

export default function Index() {
   return (
      <View style={styles.container}>
        <View style={styles.aboutTheApp}>
          <Text style={{fontSize: 20, color: 'white', fontFamily: 'Lato-Bold', lineHeight: 50, textAlign: 'justify'}}>About The App:  PlaceHolder </Text>
        </View>
        <View style={styles.mission}>
          <Text style={{fontSize: 20, color: 'white', fontFamily: 'Lato-Bold', lineHeight: 50, textAlign: 'justify'}}>
            Music Experience Reimagined
          </Text>
        </View>
        {/* <Text style={styles.paragraph}>
          Welcome to Riffle!
          Riffle is a web application that uses the publicly available Spotify API to provide users with useful statistics about their listening habits.         
      </Text> */}
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#25292e',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  paragraph: {
    fontSize: 25,
    lineHeight: 50,
    textAlign: 'justify',
  },
  aboutTheApp: {
    flexWrap: 'wrap',
    borderWidth: 5,
    borderRadius: 10,
    borderColor: '#0eaa45',
    padding: 40,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 150,
    marginLeft: 350,
    

  },
  mission: {
    flexWrap: 'wrap',
    borderWidth: 5,
    borderRadius: 10,
    borderColor: '#0eaa45',
    padding: 40,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 150,
    marginLeft: 350,
  }
});