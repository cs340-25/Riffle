import { Text, View, StyleSheet, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import WebPlayback from './WebPlayback'

export default function Stats () {
  const [profileData, setProfileData] = useState(null);
  const [artistData, setArtistData] = useState(null);
  const [trackData, setTrackData] = useState(null);

   /* add call to refresh-token function */

   async function getAccessToken(){
      try{
         const token = AsyncStorage.getItem('access_token');
         return token;
      }catch(err){
         return null;
      }
   }
   
   const token = getAccessToken();

   const formatNumberWithCommas = (number) => {
      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
   };

  useEffect(() => {
    fetchUserData();
  }, []);

   async function fetchUserData() {
      try{
         const profileResponse = await fetch('http://localhost:3000/me',);
         const artistResponse = await fetch('http://localhost:3000/me/top/artists',)
         const trackResponse = await fetch('http://localhost:3000/me/top/tracks',)
         const profileData = await profileResponse.json();
         const artistData = await artistResponse.json();
         const trackData = await trackResponse.json();
         setProfileData(profileData);
         setArtistData(artistData);
         setTrackData(trackData);
      }
      catch(error){
         console.error('Error fetching user data', error);
      }
   };

   return(
      <ScrollView contentContainerStyle={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#25292e', }}>
         <View style={styles.container}>
            {/* <View style={styles.playerContainer}>
               <WebPlayback token={token}/>
            </View> */}
            {profileData && artistData && trackData && (
               <View style={styles.container}>
                  <Image source={{ uri: profileData['images'][0]['url'] }} style={{ width: 200, height: 200 }} />
                  <Text style={{ fontSize: 40, paddingVertical: 20, color: 'white', fontFamily: 'Lato-Bold' }}>{profileData['display_name']}</Text>
               <View style={styles.playerContainer}>
                  <Text style={{ fontSize: 20, paddingVertical: 20, color: 'white', fontFamily: 'Lato-Bold' }}>WebPlayback PlaceHolder</Text>
               </View>
                  <Text style={{ fontSize: 30, paddingVertical: 20, color: 'white', fontFamily: 'Lato-Bold' }}>Top 5 Artists: </Text>
               <View style={styles.artists}>
                  {artistData['items'].slice(0, 5).map((artist, index) => (
                     <View key={index} style={styles.artistContainer}>
                        <Image source={{ uri: artist['images'][2]['url'] }} style={{ width: artist['images'][2]['width'], height: artist['images'][2]['height'] }} />
                        <Text style={{ fontSize: 20, paddingVertical: 10, color: 'white', fontFamily: 'Lato-Bold' }}>
                           {index +1}: {artist['name']}
                        </Text>
                        <Text style={{ fontSize: 20, color: 'white', fontFamily: 'Lato-Bold' }}>
                           Followers: {formatNumberWithCommas(artist['followers']['total'])}
                        </Text>
                     </View>
                  
                  ))}
               </View>
               <Text style={{ fontSize: 30, paddingVertical: 20, color: 'white', fontFamily: 'Lato-Bold' }}>Top 5 Songs: </Text>
               <View style={styles.tracks}>
                  {trackData['items'].slice(0, 5).map((track, index) => (
                        <View key={index} style={styles.trackContainer}>
                           <Image source={{ uri: track['album']['images'][1]['url'] }} style={{ width: 160, height: 160 }} />
                           <Text style={{ fontSize: 20, paddingVertical: 10, color: 'white', fontFamily: 'Lato-Bold' }}>
                              {index + 1}: {track['name']}
                           </Text>
                           <Text style={{ fontSize: 20, paddingVertical: 10, color: 'white', fontFamily: 'Lato-Bold' }}>
                              Artist(s):
                           <Text style={{ fontSize: 20, color: 'white', fontFamily: 'Lato-Bold' }}>
                               {' '}{track['artists'][0]['name']}
                           </Text>
                              {track['artists'].slice(1, track['artists'].length).map((artists, artistIndex) => (
                                 <View key={artistIndex}>
                                    <Text style={{ fontSize: 20, color: 'white', fontFamily: 'Lato-Bold' }}>
                                       , {artists['name']} 
                                    </Text>
                                 </View>
                              ))}
                           </Text>
                           <Text style={{ fontSize: 20, paddingVertical: 10, color: 'white', fontFamily: 'Lato-Bold' }}>
                              Release Date: {track['album']['release_date']}
                           </Text>
                        </View>
                  ))}
               </View>
               <View style={styles.playListContainer}>
                  <Text style={{ fontSize: 20, paddingVertical: 20, color: 'white', fontFamily: 'Lato-Bold'}}>Playlist Info PlaceHolder</Text>
               </View>
                  {/* <Text>{JSON.stringify(profileData, null, 2)}</Text> */}
                  {/* <Text>{JSON.stringify(artistData, null, 2)}</Text> */}
                  {/* <Text style={{ color: 'white'}}>{JSON.stringify(trackData, null, 2)}</Text> */}
               </View>
            )}
         </View>
    </ScrollView>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      marginTop: 30,
      backgroundColor: '#25292e',
   },
   artists: {
      borderWidth: 5,
      borderRadius: 10,
      borderColor: '#0eaa45',
      flexWrap: 'wrap',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#1a1a1a',
   },
   tracks: {
      borderWidth: 5,
      borderRadius: 10,
      borderColor: '#0eaa45',
      flexWrap: 'wrap',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      marginTop: 10,
      backgroundColor: '#1a1a1a',
   },
   artistContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      paddingHorizontal: 20,
   },
   trackContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      paddingHorizontal: 20,
   },
   playerContainer: {
      borderWidth: 5,
      borderRadius: 10,
      borderColor: '#0eaa45',
      padding: 40,
      justifyContent: 'center',
      alignItems: 'center',
   },
   playListContainer: {
      borderWidth: 5,
      borderRadius: 10,
      borderColor: '#0eaa45',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 30,
      padding: 40,
   }
});