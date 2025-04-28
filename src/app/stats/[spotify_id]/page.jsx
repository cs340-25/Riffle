'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import WebPlayback from '@/components/WebPlayback';
import TimeRangeDropdown from '@/components/TimeRangeDropdown';
import SortingDropdown from '@/components/SortingDropdown';
import ShowAllButton from '@/components/ShowAllButton';
import LoadMoreButton from '@/components/LoadMoreButton';
import OrderButton from '@/components/OrderButton';

export default function Stats() {
   const [profileData, setProfileData] = useState(null);
   const [artistData, setArtistData] = useState(null);
   const [trackData, setTrackData] = useState(null);
   const [token, setToken] = useState(null);
   const [timeRange, setTimeRange] = useState("short_term");
   const [sortMethod, setSortMethod] = useState("listen_count");
   const [hasImportedHistory, setHasImportedHistory] = useState(false);
   const [showAllArtists, setShowAllArtists] = useState(false);
   const [showAllTracks, setShowAllTracks] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
   const [trackOffset, setTrackOffset] = useState(0);
   const [artistOffset, setArtistOffset] = useState(0);
   const [isLoadingMore, setIsLoadingMore] = useState(false);
   const [isLoadingMoreArtists, setIsLoadingMoreArtists] = useState(false);
   const [hasMoreArtists, setHasMoreArtists] = useState(true);
   const [hasMoreTracks, setHasMoreTracks] = useState(true);
   const [ascending, setAscending] = useState(false);

   // Helper function to add commas to follower count
   const formatNumberWithCommas = (number) => {
      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
   };

   // Helper function to truncate text
   const truncateText = (text, maxLength) => {
      if (!text) return '';
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
   };

   useEffect(() => {
      const accessToken = localStorage.getItem("access_token");
      setToken(accessToken);

      // Check if user has imported history
      checkImportStatus();

      // Fetch data with the current time range
      fetchUserData(timeRange, sortMethod);

      // Set loading to false after everthing is loaded
      const timer = setTimeout(() => {
         setIsLoading(false);
      }, 200); // Waits 200 ms
   }, []);

   // Will call fetchUserData anytime timeRane or sortMethod changes
   useEffect(() => {

      if( token ){
         setTrackData(null);
         setArtistData(null);
         setTrackOffset(0);
         setArtistOffset(0);
         setHasMoreTracks(true);
         setHasMoreArtists(true);
         fetchUserData(timeRange, sortMethod);
      }
   }, [timeRange, sortMethod, ascending, token]);

   async function checkImportStatus() {
      try{
         const userId = localStorage.getItem("user_id");
         const response = await fetch(`http://localhost:3000/user/import-status/${userId}`);

         if( response.ok ){
            const data = await response.json();
            setHasImportedHistory(data["hasImported"]);
         }
      } catch ( error ){
         console.error("Error checking import status:", error);
      }
   }

   async function fetchUserData(range, sortMethod) {
      try {
         
         // These can be used in either statement
         const userId = localStorage.getItem("user_id");
         const token = localStorage.getItem("access_token");
         const requestOptions = {
            headers: {
               'Authorization': `Bearer ${token}`
            }
         };

         // Fetching life time stats
         if( range === "lifetime" && hasImportedHistory ) {

            // Reset offset when changing sort method
            if( trackOffset !== 0 ){
               setTrackOffset(0);
            }

            if( artistOffset !== 0 ){
               setArtistOffset(0);
            }

            const cachedData = localStorage.getItem(`lifetime_data_${sortMethod}_${ascending}`);
            const cachedTimeStamp = localStorage.getItem(`lifetime_data_timestamp_${sortMethod}_${ascending}`);
            
            const isCacheValid = cachedData && cachedTimeStamp && (Date.now() - parseInt(cachedTimeStamp) < 60 * 60 * 1000); // checks if values are null and checks if time is less than 1 hours
            
            if( isCacheValid ){
               const parsedData = JSON.parse(cachedData);
               console.log(`Using cached lifetime data sorted by ${sortMethod} in ${ascending ? 'ascending' : 'descending'} order`);
               setTrackData(parsedData);
               return;
            }
            else{
               // If cache is invalid fetch from backend
               console.log(`Fetching lifetime data sorted by ${sortMethod} in ${ascending ? 'ascending' : 'descending'} order`);
               
               try{
                  const ascendingParam = ascending.toString();
                  
                  const response = await fetch(`http://localhost:3000/lifetime-stats/${userId}?sort=${sortMethod}&offset=0&ascending=${ascendingParam}`, requestOptions);
                  
                  if( response.ok ){
                     const lifetimeData = await response.json();
                     
                     //update state
                     setTrackData(lifetimeData.tracks);
                     
                     // Update hasMoreTracks based on pagination result
                     setHasMoreTracks(lifetimeData.pagination.hasMore);
                     
                     localStorage.setItem(`lifetime_data_${sortMethod}_${ascending}`, JSON.stringify(lifetimeData.tracks));
                     localStorage.setItem(`lifetime_data_timestamp_${sortMethod}_${ascending}`, Date.now().toString());
                     
                     console.log(`Cached lifetime data sorted by ${sortMethod} in ${ascending ? 'ascending' : 'descending'} order`);
                  }
                  else{
                     console.error("Error fetching lifetime data:", response.status);
                  }
               } catch (err) {
                  console.error("Error fetching lifetime data:", err);
               }
            }
            
            // Also fetch artist data
            const cachedArtistData = localStorage.getItem(`lifetime_artists_${sortMethod}_${ascending}`);
            const cachedArtistTimeStamp = localStorage.getItem(`lifetime_artists_timestamp_${sortMethod}_${ascending}`);
            
            const isArtistCacheValid = cachedArtistData && cachedArtistTimeStamp && (Date.now() - parseInt(cachedArtistTimeStamp) < 60 * 60 * 1000);
         
            if( isArtistCacheValid ){
               const parsedArtistData = JSON.parse(cachedArtistData);
               console.log(`Using cached lifetime artist data sorted by ${sortMethod} in ${ascending ? 'ascending' : 'descending'} order`);
               setArtistData(parsedArtistData);
            }
            else{
               try {
                  const ascendingParam = ascending.toString();
                  
                  const artistResponse = await fetch(`http://localhost:3000/lifetime-artists/${userId}?sort=${sortMethod}&offset=0&ascending=${ascendingParam}`, requestOptions);
                  
                  if (artistResponse.ok) {
                     const lifetimeArtistData = await artistResponse.json();
                     
                     console.log("Artist data from API:", lifetimeArtistData.artists);

                     setArtistData(lifetimeArtistData.artists);
                     setHasMoreArtists(lifetimeArtistData.pagination.hasMore);
                     
                     localStorage.setItem(`lifetime_artists_${sortMethod}_${ascending}`, JSON.stringify(lifetimeArtistData.artists));
                     localStorage.setItem(`lifetime_artists_timestamp_${sortMethod}_${ascending}`, Date.now().toString());
                     
                     console.log(`Cached lifetime artist data sorted by ${sortMethod} in ${ascending ? 'ascending' : 'descending'} order`);
                  } else {
                     console.error("Error fetching lifetime artist data:", artistResponse.status);
                  }
               } catch (err) {
                  console.error("Error fetching lifetime artist data:", err);
               }
            }
         }
         else{ // Fetching regular stats from spotify api
            const cachedData = localStorage.getItem(`spotify_data_${range}`);
            const cachedTimeStamp = localStorage.getItem(`spotify_data_timestamp_${range}`);
            
            const isCacheValid = cachedData && cachedTimeStamp && (Date.now() - parseInt(cachedTimeStamp) < 60 * 60 * 1000); // checks if values are null and checks if time is less than 1 hours
            
            if( isCacheValid ){
               const parsedData = JSON.parse(cachedData);
               setProfileData(parsedData["profile"]);
               setArtistData(parsedData["artists"]);
               setTrackData(parsedData["tracks"]);
               console.log("Using cached spotify data");
               return;
            }
   
            // No valid cache so fetch new data
            const profileResponse = await fetch('http://localhost:3000/me', requestOptions);
            const artistResponse = await fetch(`http://localhost:3000/me/top/artists?time_range=${range}`, requestOptions);
            const trackResponse = await fetch(`http://localhost:3000/me/top/tracks?time_range=${range}`, requestOptions);
            
            const profileData = await profileResponse.json();
            const artistData = await artistResponse.json();
            const trackData = await trackResponse.json();
            setProfileData(profileData);
            setArtistData(artistData);
            setTrackData(trackData);
   
            // Cache the data for later use
            const dataToCache = {
               profile: profileData,
               artists: artistData,
               tracks: trackData
            };
            
            localStorage.setItem(`spotify_data_${range}`, JSON.stringify(dataToCache));
            localStorage.setItem(`spotify_data_timestamp_${range}`, Date.now().toString());
            
            console.log(`Fetched and cached spotify data for ${range}`);
         }
      } catch (error) {
         console.error('Error fetching user data', error);
      }
   }

   // Function to load more tracks
   async function loadMoreTracks() {
      if( isLoading || !hasMoreTracks ) return;

      setIsLoadingMore(true);

      try{

         const userId = localStorage.getItem("user_id");
         const token = localStorage.getItem("access_token");
         const nextOffset = trackOffset + 50;
         
         // Convert boolean to string for URL parameter
         const ascendingParam = ascending.toString();

         // Fetch the next batch of tracks
         const response = await fetch( `http://localhost:3000/lifetime-stats/${userId}?sort=${sortMethod}&offset=${nextOffset}&ascending=${ascendingParam}`, {
            headers: {
               'Authorization': `Bearer ${token}`
            }
         });
         
         if (response.ok) {
            const moreTracksData = await response.json();
            
            // If we got fewer than 50 tracks, there are no more to load
            if (moreTracksData.tracks.items.length < 50) {
               setHasMoreTracks(false);
            }
            
            // If we got no tracks, there are no more to load
            if (moreTracksData.tracks.items.length === 0) {
               setHasMoreTracks(false);
               setIsLoadingMore(false);
               return;
            }
            
            // Combine the new tracks with existing ones
            const combinedTracks = {
               ...trackData,
               items: [...trackData.items, ...moreTracksData.tracks.items]
            };
            
            // Update state
            setTrackData(combinedTracks);
            setTrackOffset(nextOffset);
            
            // Update the cache
            localStorage.setItem(`lifetime_data_${sortMethod}_${ascending}`, JSON.stringify(combinedTracks));
            localStorage.setItem(`lifetime_data_timestamp_${sortMethod}_${ascending}`, Date.now().toString());
            
            console.log(`Loaded ${moreTracksData.tracks.items.length} more tracks, new total: ${combinedTracks.items.length}`);
         } else {
            console.error("Error fetching more tracks:", response.status);
            setHasMoreTracks(false);
         }
      } catch (error) {
         console.error("Error loading more tracks:", error);
         setHasMoreTracks(false);
      } finally {
         setIsLoadingMore(false);
      }
   }

   // Function to load more artists
   async function loadMoreArtists() {
      if (isLoadingMoreArtists || !hasMoreArtists) return;
      
      setIsLoadingMoreArtists(true);
      
      try {
         const userId = localStorage.getItem("user_id");
         const token = localStorage.getItem("access_token");
         const nextOffset = artistOffset + 50;
         const ascendingParam = ascending.toString();
         
         // Fetch the next batch of artists
         const response = await fetch(
            `http://localhost:3000/lifetime-artists/${userId}?sort=${sortMethod}&offset=${nextOffset}&ascending=${ascendingParam}`,
            {
               headers: {
               'Authorization': `Bearer ${token}`
               }
            }
         );
         
         if (response.ok) {
            const moreArtistsData = await response.json();
            
            // If we got fewer than 50 artists, there are no more to load
            if (moreArtistsData.artists.items.length < 50) {
               setHasMoreArtists(false);
            }
            
            // If we got no artists, there are no more to load
            if (moreArtistsData.artists.items.length === 0) {
               setHasMoreArtists(false);
               setIsLoadingMoreArtists(false);
               return;
            }
            
            // Combine the new artists with existing ones
            const combinedArtists = {
               ...artistData,
               items: [...artistData.items, ...moreArtistsData.artists.items]
            };
            
            // Update state
            setArtistData(combinedArtists);
            setArtistOffset(nextOffset);
            
            // Update the cache
            localStorage.setItem(`lifetime_artists_${sortMethod}_${ascending}`, JSON.stringify(combinedArtists));
            localStorage.setItem(`lifetime_artists_timestamp_${sortMethod}_${ascending}`, Date.now().toString());
         } else {
            console.error("Error fetching more artists:", response.status);
            setHasMoreArtists(false);
         }
      } catch (error) {
         console.error("Error loading more artists:", error);
         setHasMoreArtists(false);
      } finally {
         setIsLoadingMoreArtists(false);
      }
   }
   
   // Handle time range change
   const handleTimeRangeChange = (newRange) => {
      setTimeRange(newRange);
   }
   
   // Handle sorting change
   const handleSortingChange = (newSort) => {
      setSortMethod(newSort);
      setTrackData(null);
      setTrackOffset(0);
      setArtistOffset(0);
      setHasMoreTracks(true);
      setHasMoreArtists(true);
   }
   
   const handleShowAllArtistsChange = (showAllArtists) => {
      setShowAllArtists(showAllArtists);
   }
   
   const handleShowAllTracksChange = (showAllTracks) => {
      setShowAllTracks(showAllTracks);
   }
   
   const handleLoadMoreTracks = () => {
      loadMoreTracks();
   }
   
   const handleLoadMoreArtists = () => {
      loadMoreArtists();
   };

   const handleOrderChange = (ascending) => {
      setAscending(ascending);
   }

   // Handle user selecting top track to fill in web playback
   // const handlePlayTrack = (track) => {

   // }

   // Show loading state while data is being fetched
   if (isLoading) {
      return (
         <div className={styles.container}>
            <div className={styles.loadingContainer}>
               <p>Loading your stats...</p>
            </div>
         </div>
      );
   }

   return (
      <div className={styles.container}>
         <div className={styles.contentWrapper}>
            {!hasImportedHistory && (
               <div className={styles.importTitle}>
                  Import Spotify Listening History to View Lifetime Stats
               </div>
            )}
         {artistData && trackData && (
            <div className={styles.contentWrapper}>
               <div className={styles.dropdownContainer}>
                  <TimeRangeDropdown
                     selectedRange={timeRange}
                     onChange={handleTimeRangeChange}
                     hasImportedHistory={hasImportedHistory}
                  />
               </div>
               <div className={styles.cardContainer}>
                  <div className={styles.webPlaybackContainer}>
                     {token && profileData ? <WebPlayback token={token} timeRange={timeRange}/> : null}
                  </div>
               </div>
               
               {timeRange !== "lifetime" ? (
                  <>
                  <div className={styles.displayTitle}>
                     <p className={styles.sectionTitle}>Top Artists</p>
                     <ShowAllButton
                        isShowingAll={showAllArtists}
                        onChange={handleShowAllArtistsChange}
                     />
                  </div>
                  <div className={styles.cardContainer}>
                  {artistData?.items?.slice(0, showAllArtists ? 50 : 5).map((artist, index) => (
                     <div key={index} className={styles.cardItem}>
                        {artist['images'] && artist['images'][2] && (
                        <Image 
                           src={artist['images'][1]['url']} 
                           alt={artist['name']} 
                           width={160} 
                           height={160}
                           className={styles.cardArtistImage}
                        />
                        )}
                        
                        <p className={styles.cardTitle}>
                        {index + 1}. {artist['name']}
                        </p>
                        
                        <p className={styles.cardSubtitle}>
                        Followers: {formatNumberWithCommas(artist.followers.total)}
                        </p>
                     </div>
                  ))}
                  </div>
                  
                  <div className={styles.displayTitle}>
                     <p className={styles.sectionTitle}>Top Tracks</p>
                     <ShowAllButton
                        isShowingAll={showAllTracks}
                        onChange={handleShowAllTracksChange}
                     />
                  </div>
                  <div className={styles.cardContainer}>
                     {trackData?.items?.slice(0, showAllTracks ? 50 : 5).map((track, index) => (
                        <div key={index} className={styles.cardItem}>
                           {track['album']['images'] && track['album']['images'][1] && (
                           <Image 
                              src={track['album']['images'][1]['url']} 
                              alt={track['name']} 
                              width={160} 
                              height={160}
                              className={styles.cardAlbumImage}
                           />
                           )}
                           
                           <p className={styles.cardTitle}>
                              {index + 1}. {truncateText(track['name'], 25)}
                           </p>
                           
                           <p className={styles.cardSubtitle}>
                              Artist(s): {
                                 truncateText(
                                    track.artists.map(artist => artist.name).join(', '), 
                                    40
                                 )
                              }
                           </p>

                           {/* <p className={styles.cardDetail}>
                           Release Date: {track['album']['release_date']}
                           </p> */}
                        </div>
                     ))}
                  </div>
                  </>
               ) : (
                  <>
                     {/* <div className={styles.displayTitle}>
                        <p className={styles.lifetimeTitle}>Top Artists</p>
                        <SortingDropdown
                           selectedMethod={sortMethod}
                           onChange={handleSortingChange}
                        />
                        <OrderButton
                           isAscending={ascending}
                           onChange={handleOrderChange}
                        />
                     </div>
                     {artistData && (
                        <div className={styles.cardContainer}>
                           {artistData?.items?.map((artist, index) => (
                              <div key={`${artist.name}-${sortMethod}-${index}`} className={styles.cardItem}> */}
                                 {/* Artist Image */}
                                 {/* <Image 
                                    src={artist["images"][0]["url"]} 
                                    alt={artist["name"]} 
                                    width={160} 
                                    height={160}
                                    className={styles.cardArtistImage}
                                 />
                                 
                                 <p className={styles.cardTitle}>
                                    {index + 1}. {artist["name"]}
                                 </p>
                                  */}
                                 {/* Artist Stats */}
                                 {/* <div className={styles.statsContainer}>
                                    <div className={styles.statItem}>
                                       <span>Plays: {artist?.stats?.listen_count}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                       <span>Minutes: {artist?.stats?.minutes_listened.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                       <span>Skips: {artist?.stats?.skip_count}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                     {hasMoreArtists && (
                     <LoadMoreButton
                        isLoading={isLoadingMoreArtists}
                        hasMore={hasMoreArtists}
                        onClick={handleLoadMoreArtists}
                     />
                     )} */}
                     <div className={styles.displayTitle}>
                        <p className={styles.lifetimeTitle}>Top Tracks</p>
                        <SortingDropdown
                           selectedMethod={sortMethod}
                           onChange={handleSortingChange}
                        />
                        <OrderButton
                           isAscending={ascending}
                           onChange={handleOrderChange}
                        />
                     </div>
                     <div className={styles.cardContainer}>
                        {trackData?.items?.map((track, index) => (
                           <div key={`${track["id"]}-${sortMethod}-${index}`} className={styles.cardItem}>
                              {/* Track Image */}
                              {track['album']['images'] && track['album']['images'][0] && (
                                 <Image 
                                    src={track['album']['images'][0]['url']} 
                                    alt={track['name']} 
                                    width={160} 
                                    height={160}
                                    className={styles.cardAlbumImage}
                                 />
                              )}
                                 
                              <p className={styles.cardTitle}>
                                 {index + 1}. { track['name'] }
                              </p>
                                 
                              <p className={styles.cardSubtitle}>
                                 Artist(s): {track.artists.map(artist => artist.name).join(', ')}
                              </p>

                              {/* Track Stats */}
                              {track["stats"] && (
                                 <div className={styles.statsContainer}>
                                    <div className={styles.statItem}>
                                       <span>Plays {track["stats"]["listen_count"]}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                       <span>Minutes {track["stats"]["minutes_listened"].toFixed(2)}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                       <span>Skips {track["stats"]["skip_count"]}</span>
                                    </div>
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                     {hasMoreTracks && (
                        <LoadMoreButton
                           isLoading={isLoadingMore}
                           hasMore={hasMoreTracks}
                           onClick={handleLoadMoreTracks}
                        />
                     )}
                  </>
               )}
            </div>
         )}
         </div>
      </div>
   );
}