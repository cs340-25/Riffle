require('dotenv').config();
const express = require('express');  // Web server framework
const axios = require('axios');  // Makes HTTP requests
const cors = require('cors');  // Allows frontend requests

/* Database access */
const { upsertUserProfile } = require('./db/userProfile');
const { upsertTrack } = require('./db/trackInfo');
const { upsertTrackInteractions,updateTrackInteraction, calculateMinutesListened, recalculateCounts, removeTracksUnderThreshold } = require('./db/trackInteractions');
const { initializeUserSettings } = require('./db/userSettings');
const supabase = require('../lib/supabaseclient');

const app = express();
app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

const activeConnections = new Map(); // Used for progress updates, will get sent to front end

/*---Helper functions---*/

async function getTrackData(trackIds, accessToken) {
   const defaultImagePath = "http://localhost:8081/images/no_image_provided.png";
   try {
      const batchSize = 50;
      const trackData = {};

      for(var i = 0; i < trackIds.length; i += batchSize) {
         const batch = trackIds.slice(i, i + batchSize);

         const response = await axios.get('https://api.spotify.com/v1/tracks', {
            params: {
               ids: batch.join(',')
            },
            headers: {
               'Authorization': `Bearer ${accessToken}`
            }
         });

         // Store duration for each track
         response.data.tracks.forEach(track => {
            if(track) {
               //console.log(`Processing track: ${track.id}, Name: ${track.name}, Artist: ${track.artists?.[0]?.name || 'Unknown'}`);
               
                // Check if album images exist
                const hasAlbumImages = track.album && 
                  track.album.images && 
                  Array.isArray(track.album.images) && 
                  track.album.images.length > 0;

               // Set the image URL or default
               const imageUrl = hasAlbumImages 
                  ? track.album.images[0].url 
                  : defaultImagePath;  // Default image path

               //console.log(`Album images array for ${track.id}:`, 
               // hasAlbumImages ? JSON.stringify(track.album.images) : "No images available");

               trackData[track.id] = {
                  duration_ms: track.duration_ms,
                  album_image: imageUrl
               };
               
               // Log what we're actually storing
               //console.log(`Using image for ${track.id}: ${imageUrl}`);
            } else {
               console.log(`Found null track in batch`);
            }
         });

         // Delay to avoid hitting rate limits
         if((i / batchSize + 1) % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
         }
      }

      return trackData;
   } catch(error) {
      console.error("Error fetching track durations:", error.message);
      return {};
   }
}

// Processing function
async function processImportInBackground(userId, files, accessToken) {

   let connection = activeConnections.get(userId);

   if( !connection ) {
      console.log(`No connection found for user ${userId}`);
      return;
   }

   console.log(`Starting import processing for user ${userId}`);

   const startTime = Date.now();
   const startDate = new Date(startTime);
   const formattedStartTime = startDate.toLocaleTimeString();
   console.log(`Started at ${formattedStartTime}`);

   try{

      if( !accessToken ){
         throw new Error("Access token not available");
      }

      // Calculate total entries across all files for progress tracking
      let totalEntries = 0;
      files.forEach(file => {
         totalEntries += file.data.length;
      });

      // Track unique track ids for calculations later
      const uniqueTracks = new Set();
      const uniqueTrackIds = new Set();
      let processedEntries = 0;
      let skippedEntries = 0; // For tracks with no uri (User uploaded tracks)
      let currentFileIndex = 0;
      const totalFiles = files.length;

      // First need to process all entries and collect track ids
      for( const fileData of files ){
         currentFileIndex++;
         console.log(`\n========= Processing file ${currentFileIndex}/${totalFiles}: ${fileData.name} =========`);
         console.log(`Entries in this file: ${fileData.data.length}`);

         const entries = fileData.data; // Array of spotify history entries

         // Process each entry
         for( const entry of entries ){
            //Skip entries without URI
            if( !entry["spotify_track_uri"] ) {
               skippedEntries++;
               processedEntries++;
               continue;
            }

            // Extract the track id from the URI
            const trackId = entry["spotify_track_uri"].split(':')[2];

            // Collect unique track ids for fetching the total length of song (not included in json provided by spotify)
            uniqueTrackIds.add(trackId);

            // Create a track info object with proper structure
            const trackInfo = {
               userId,
               trackId,
               msPlayed: entry["ms_played"],  // Directly use the value from entry
               trackName: entry["master_metadata_track_name"] || "Unknown Track",
               artistName: entry["master_metadata_album_artist_name"] || "Unknown Artist",
               albumName: entry["master_metadata_album_album_name"] || "Unknown Album"
            };

            uniqueTracks.add(trackInfo);

            processedEntries++;

            // Update progress every entry or if completed
            if( processedEntries % 100 === 0 || processedEntries === totalEntries ){
               //console.log("Process 100 entries...");
               sendProgressUpdate(connection, {
                  status: "processing",
                  progress: Math.round((processedEntries/totalEntries) * 20), // 20% for first part
                  processed: processedEntries,
                  total: totalEntries,
                  phase: "collecting"
               });
            }
         }
         //console.log(`Completed processing file ${currentFileIndex}/${totalFiles}: ${fileData.name}`);
         //console.log(`Processed entries: ${processedEntries}, Skipped entries: ${skippedEntries}`);
      }

      // Fetch data from spotify api
      console.log("Fetching track data from spotify...");
      setTimeout( () => {
         sendProgressUpdate(connection, {
            status: "processing",
            progress: 25, // Putting this here to mark the change in phases
            phase: "fetching_track_data"
         });
      }, 2000);
      const apiTrackData = await getTrackData(Array.from(uniqueTrackIds), accessToken);

      sendProgressUpdate(connection, {
         status: "processing",
         progress: 30, // 30% after fetching data, these are just numbers based on how much calculation i think is being done, they can be anything
         phase: "fetching_track_data"
      });

      // Used to group interactions by track id
      const trackInteractions = new Map();

      for( const trackInfo of uniqueTracks ){
         if( !trackInteractions.has(trackInfo["trackId"]) ) {
            trackInteractions.set(trackInfo["trackId"], []);
         }
         trackInteractions.get(trackInfo["trackId"]).push(trackInfo);
      }

      // Process all track interactions
      let interactionCount = 0;
      const totalTracks = trackInteractions.size;
      
      console.log("Processing track interactions...")
      setTimeout( () => {
         sendProgressUpdate(connection, {
            status: "processing",
            progress: 35, // Still 35 at the start of the processing phase, longest phase so should have the most %
            phase: "processing_interactions"
         });
      }, 2000);

      processedEntries = 0;
      for await (const [trackId, interactions] of trackInteractions) {
         try{
            const firstInteraction = interactions[0];
            const { duration_ms, album_image } = apiTrackData[trackId] || { duration_ms: 0, album_image: null };
         
            // Prepare track data
            const trackData = {
               id: trackId,
               name: firstInteraction.trackName || "Unknown Track",
               artists: [{ name: firstInteraction.artistName || "Unknown Artist" }],
               album: { 
                  name: firstInteraction.albumName || "Unknown Album", 
                  images: album_image ? [{ url: album_image }] : [] 
               }
            };

            //console.log(`Processing track: ${trackId}, Name: ${trackData.name}, Artist: ${trackData.artists[0].name}`);
            //console.log(`Album images array:`, JSON.stringify(trackData.album.images));
         
            // Upsert track
            const { track, error: trackError } = await upsertTrack(trackData);
            if( trackError ){
               console.error("Error upserting track:", trackError);
               continue;
            }
         
            // Process all interactions for this track
            for( const interaction of interactions ) {

               const { trackData: interactionData, error: interactionError } = await upsertTrackInteractions(
                  userId, 
                  trackId, 
                  interaction.msPlayed || 0, // Ensure msPlayed is valid
                  duration_ms
               );
         
               if( interactionError ){
                  console.error("Error upserting track interaction:", interactionError);
               }
            }
         
            interactionCount++;
         
            // Update progress more frequently
            if( interactionCount % 100 === 0 || interactionCount === totalTracks ){
               processedEntries += 100;
               console.log(`Processed ${processedEntries}/${totalTracks}`);
               sendProgressUpdate(connection, {
                  status: "processing",
                  progress: 35 + Math.round((interactionCount/totalTracks) * 50), // Up to 85
                  phase: "processing_interactions",
                  interactionCount,
                  totalTracks
               });
            }
         } catch (error) {
            console.error(`Error processing track ${trackId}:`, error);
            // Continue with the next track instead of failing the entire import
            interactionCount++;
            continue;
         }
      }

      // Calculate minutes listened for all processed tracks
      console.log("Calculating statistics for all tracks...");
      setTimeout( ()=> {
         sendProgressUpdate(connection, {
            status: "processing",
            progress: 85, // Still 85 at the start of the calculating phase
            phase: "calculating"
         });
      }, 2000);

      let calculatedTracks = 0;
      const totalTrackIds = uniqueTrackIds.size;
      let calcTracking = 0;
      for( const trackId of uniqueTrackIds ){
         try {
            await calculateMinutesListened(userId, trackId);
            calculatedTracks++;

            // Update progress
            if( calculatedTracks % 100 === 0 || calculatedTracks === totalTrackIds ){
               calcTracking += 100;
               console.log(`Calculated ${calcTracking}/${totalTrackIds}`);
               sendProgressUpdate(connection, {
                  status: "processing",
                  progress: 85 + Math.round((calculatedTracks/totalTrackIds) * 10), // 10% for calculating
                  phase: "calculating",
                  calculatedTracks,
                  totalTracks: totalTrackIds
               });
            }
         } catch (err) {
            console.error(`Error calculating minutes for track ${trackId}:`, err);
            calculatedTracks++;
         }
      }

      // Remove tracks with zero minutes listened
      console.log("Removing interactions with zero minutes listened...");
      setTimeout(() => {
         sendProgressUpdate(connection, {
            status: "processing",
            progress: 95, // 95% complete
            phase: "cleaning_up"
         });
      }, 2000);

      console.log("Rmeoving interactions with less than threshold minutes")
      const { deleted, count, error: cleanupError } = await removeTracksUnderThreshold(userId);
      
      if( cleanupError ){
         console.error("Error cleaning up tracks", cleanupError);
      } else{
         console.log(`Removed ${count} tracks with zero minutes listened`);
      }


      const endTime = Date.now();
      const endDate = new Date(endTime);
      const formattedEndTime = endDate.toLocaleTimeString();
      console.log(`Completed at ${formattedEndTime}`);
      const elapsedTime = (((endTime - startTime)/1000)/60).toFixed(2);
      console.log(`Import progress completed in ${elapsedTime} minutes`);

      // Update user profile to reflect import
      const { user, error } = await upsertUserProfile({
         id: userId,
         imported_history: true
      });

      // Send final completion update
      sendProgressUpdate(connection, {
         status: "complete",
         progress: 100,
         phase: "done",
         totalProcessed: processedEntries,
         totalSkipped: skippedEntries,
         uniqueTracks: uniqueTrackIds.size,
         tracksUnderThreshold: count || 0
      });

   } catch(error){
      console.error("Error in import process:", error);
      sendProgressUpdate(connection, {
         status: "error",
         error: error.message
      });
   }
}

// Function to send progress updates
function sendProgressUpdate(connection, data) {
   
   if (!connection || !connection.res) {
      //console.log("No active connection for progress update");
      return;
   }
   
   try {
      // Write data
      connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
   } catch (error) {
      console.error("Error sending progress update:", error);
   }
}

/*------Endpoints------*/

/* Store token and instantiate all user related data */
app.post('/store-token', async (req, res) => {
   const {access_token, refresh_token, expires_in} = req.body;
   if(!access_token || !refresh_token || !expires_in){
      return res.status(400).json({error: 'Token, refresh token, or expiration time missing'});
   }

   // This allows the client to continue without waiting for data processing
   res.json({
      message: 'Token stored successfully',
      status: 'processing'
   });

   try {
      // Fetch the user's Spotify profile using the access token
      const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
         headers: { Authorization: `Bearer ${access_token}` }
      });
      const profileData = profileResponse['data'];

      // Use the dedicated user profile function to upsert/fetch the user
      const { user, error: profileError } = await upsertUserProfile(profileData);
      if (profileError) {
         console.error('Error upserting user:', profileError);
         return;
      }

      const { settings, error: settingsError } = await initializeUserSettings(profileData['id'])
      if (settingsError) {
         console.error('Error initializing settings:', settingsError);
         return;
      }

      //console.log('User data fetched successfully:', user);
      //console.log('Settings', settings);

   } catch (err) {
      console.error('Error processing user data:', err.response?.data || err.message);
   }
});

app.post('/refresh-token', async(req, res) => {
   
   const refreshToken = req.body.refresh_token;
   
   if(!refreshToken){
      return res.status(401).json({error: 'No refresh token available'});
   }

   try{
      const response = await axios.post(tokenEndpoint, new URLSearchParams({
         grant_type: 'refresh_token',
         refresh_token: refreshToken,
         client_id: clientId,
         client_secret: clientSecret,
      }));

      const { access_token, expires_in } = response.data;
      const tokenExpiry = Date.now() + (expires_in*1000);

      res.json({
         access_token: access_token,
         expires_in: tokenExpiry,
      });
   }
   catch(error){
      console.error('Error refreshing token:', error.response.data || error.message);
      res.status(500).json({ error: 'Failed to refresh token' });
   }
});

/* Test API Call */
app.get('/me', async (req,res) => {

   const token = req.headers.authorization?.split(' ')[1];

   if(!token){
      return res.status(401).json({error: 'No access token available'});
   }


   try{
      const response = await axios.get('https://api.spotify.com/v1/me', {
         headers: { Authorization: `Bearer ${token}`}
      });
      const userId = response["data"]["id"];

      res.json(response.data);
   }
   catch(error){
      console.error('Error fetching user data:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch user data' });
   }
});

/* GetUsersTopArtists */
app.get('/me/top/artists', async (req,res) => {

   const token = req.headers.authorization?.split(' ')[1];
   const timeRange = req.query.time_range || "short_term";

   if(!token){
      return res.status(401).json({error: 'No access token available'});
   }

   try{
      const response = await axios.get(`https://api.spotify.com/v1/me/top/artists?limit=50&time_range=${timeRange}`, {
         headers: { Authorization: `Bearer ${token}`}
      });
      res.json(response.data);
   }
   catch(error){
      console.error('Error fetching user data:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch user data' });
   }
});

/* get top tracks */
app.get('/me/top/tracks', async (req,res) => {

   const token = req.headers.authorization?.split(' ')[1];
   const timeRange = req.query.time_range || "short_term";

   if(!token){
      return res.status(401).json({error: 'No access token available'});
   }

   try{
      const response = await axios.get(`https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${timeRange}`, {
         headers: { Authorization: `Bearer ${token}`}
      });
      res.json(response.data);
   }
   catch(error){
      console.error('Error fetching user data:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch user data' });
   }
});

// Used to delete user account
app.delete('/user/:userId', async (req, res) =>{

   const userId = req.params.userId;

   try{
      const { data, error } = await supabase
         .from('User Profile')
         .delete()
         .eq('spotify_id', userId)
   
      if( error ){
         console.error("Error deleting user:", error);
         return res.status(500).json({error: "Failed to delete account"});
      }

      res.json({success: true, message: "Account successfully deleted"});
   } catch(error){
      console.error("Error deleting user account", error);
      res.status(500).json({error: "Failed to delete account"});
   }
});

// Used to update user settings
app.put('/settings/:userId', async (req, res) => {

   const userId = req.params.userId;
   const { skip_threshold, min_minutes_threshold, theme } = req.body;

   const udpateFields = {};
   //console.log(`The skip threshold received is ${skip_threshold}`);
   if( skip_threshold !== undefined ) udpateFields.skip_threshold = skip_threshold;
   if( min_minutes_threshold !== undefined ) udpateFields.min_minutes_threshold = min_minutes_threshold;
   if( theme !== undefined ) udpateFields.theme = theme;

   if( Object.keys(udpateFields).length === 0 ){
      return res.status(400).json({error: "No update fields provided"});
   }

   //console.log(`Update fields: ${udpateFields["skip_threshold"]}`);

   try{
      const {data, error} = await supabase
         .from('Settings')
         .update(udpateFields)
         .eq('user_id', userId)
         .select(); 

      if( error ){
         console.error("Error updating settings:", error);
         return res.status(500).json({ error: 'Failed to update settings' });
      }

      let recalculationResult = null;

      // If skip threshold was updated, recalculate statistics
      if( skip_threshold !== undefined ){
         //console.log(`Recalculating track statistics with new threshold ${skip_threshold}`);
         recalculationResult = await recalculateCounts(userId, skip_threshold);

         if( recalculationResult.error ){
            console.error("Error recalculating counts:", recalculationResult.error);
            res.json({
               success: true,
               message: "Settings updated, but failed to recalculate tracks",
               settings: data[0],
               recalculationError: recalculationResult.error
            });
         }
      }

      // Return success with settings and recalc result
      res.json({
         success: true,
         message: recalculationResult ? 
            `Settings updated successfully. Updated ${recalculationResult.updatedCount} track interactions.` : 
            "Settings updated successfully",
         settings: data[0],
         recalculation: recalculationResult
      });

   } catch( error ){
      console.error("Error in settings update:", error);
      return res.status(500).json({error: "Failed to update settings"});
   }
});

// Used to fetch user settings to prefill settings page
app.get('/settings/:userId', async (req, res) => {

   const userId = req.params.userId;

   try{
      const { data, error } = await supabase
         .from('Settings')
         .select('*')
         .eq('user_id', userId)
         .single();
      
      if (error) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
      }
    
      res.json({ 
         success: true,
         settings: data
      });

   } catch( error ){
      console.error('Error in fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
   }

});

// Endpoint for progress updates, uses the connection declared at the top
app.get('/import-progress/:userId', (req, res) => {

   const userId = req.params.userId;

   // Get access token
   const accessToken = req.query.token;

   // Set headers for connection
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   res.setHeader('X-Accel-Buffering', 'no');
   res.flushHeaders();

   const connection = {
      res,
      accessToken
   };

   // Store connection with access token
   activeConnections.set(userId, connection);

   //console.log(`Connection established for user ${userId}`);

   // Send initial connection message
   res.write('data: {"status": "connected"}\n\n');

   req.on('close', () => {
      activeConnections.delete(userId);
      //console.log(`Connection closed for user ${userId}`);
   });

});

// Endpoint for processing and storing imported spotify history
app.post('/import-history/:userId', async (req, res) => {

   const userId = req.params.userId;
   const {files} = req.body;
   const accessToken = req.headers.authorization?.split(' ')[1];

   if( !files || !Array.isArray(files) || files.length === 0 ){
      return res.status(400).json({error: "No files provided"});
   }

   // Start processing
   res.json({
      message: "Import processing started",
      status: "processing"
   });

   // Add a delay to allow the client to establish connection
   setTimeout(() =>{
      processImportInBackground(userId, files, accessToken);
   }, 2000);
});

// Check if a user has imported their history
app.get('/user/import-status/:userId', async (req, res) => {
   const userId = req.params.userId;

   try{
      const { data, error } = await supabase
         .from("User Profile")
         .select("imported_history")
         .eq("spotify_id", userId)
         .single();

      if( error ) {
         console.error("Error checking import status:", error);
         return res.status(500).json({ error: "Failed to check import status" });
      }

      return res.json({
         hasImported: data?.imported_history || false
      });
   } catch (error ){
      console.error('Error in import status check:', error);
      return res.status(500).json({ error: 'Failed to check import status' });
   }
});

// Endpoint to get track statistics for a specific user and track
app.get('/track-stats/:userId/:trackId', async (req, res) => {

   const { userId, trackId } = req.params;
   let trackDuration_ms = 0;
   const token = req.headers.authorization?.split(' ')[1];

   try {
      const { data, error } = await supabase
         .from('Track Interactions')
         .select('*')
         .match({ user_id: userId, track_id: trackId })
         .single();
        
      if (error && error.code !== 'PGRST116') {
         console.error('Error fetching track stats:', error);
         return res.status(500).json({ error: 'Failed to fetch track statistics' });
      }
      
      if( data ){
         //console.log("Getting duration from data");
         trackDuration_ms = data["track_duration"];
      }
      // If song is not in the database, make api call to get track duration
      else if(token){
         //console.log("getting duration from api call")
         try {
            const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
               headers: { Authorization: `Bearer ${token}` }
            });
            
            trackDuration_ms = response["data"]["duration_ms"] || 0;
            //console.log(`Fetched track duration from Spotify API: ${trackDuration_ms}ms`);
         } catch (error) {
            //console.log("Couldn't get track duration from Spotify API:", error.message);
         }
      } 
      
      // If no record exists yet, return default stats
      if (!data) {
         //console.log(`No data but track duration is ${trackDuration_ms}`);
         return res.json({ 
            isFirstPlay: true,
            listenCount: 0,
            skipCount: 0,
            minutesListened: 0,
            trackDuration: trackDuration_ms,
            rank: null // Will implement rank later
         });
      }
      //console.log(`Data and track duration is ${trackDuration_ms}`);
      // Return the statistics
      return res.json({
         isFirstPlay: data["listen_count"] === 0 && data["skip_count"] === 0,
         listenCount: data["listen_count"],
         skipCount: data["skip_count"],
         minutesListened: data["minutes_listened"],
         playData: data["play_data"],
         trackDuration: trackDuration_ms,
         rank: null // Will implement rank later
      });
   } catch (error) {
      console.error('Error in track stats endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
});

// Endpoint to update track interaction when a song is played/skipped
app.post('/track-interaction/:userId/:trackId', async (req, res) => {
   const { userId, trackId } = req.params;
   const { playDuration, trackDuration } = req.body;
      
   if (!playDuration || !trackDuration) {
      return res.status(400).json({ error: 'Missing required fields' });
   }
      
   try {
      // First, get the user's skip threshold
      const { data: settings, error: settingsError } = await supabase
         .from('Settings')
         .select('skip_threshold')
         .eq('user_id', userId)
         .single();
         
      if (settingsError) {
         console.error('Error fetching user settings:', settingsError);
         return res.status(500).json({ error: 'Failed to fetch user settings' });
      }
      
      const skipThreshold = settings["skip_threshold"] || 20; // Default to 20 if not set
      
      // Update the track interaction
      const { data, error } = await updateTrackInteraction(
         userId, 
         trackId, 
         playDuration, 
         skipThreshold,
         trackDuration
      );
      
      if (error) {
         console.error('Error updating track interaction:', error);
         return res.status(500).json({ error: 'Failed to update track interaction' });
      }
      
      // Return the updated interaction data
      res.json({ 
         success: true,
         interaction: data 
      });
      
   } catch (error) {
      console.error('Error in track interaction endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
});

// Endpoint to fetch lifetime tracks from the database
app.get('/lifetime-stats/:userId', async (req, res) => {

   const userId = req.params.userId;
   const sortMethod = req.query.sort || "listen_count";
   const offset = parseInt(req.query.offset) || 0;
   const ascending = req.query.ascending === "true";

   //console.log(`Fetching data with: sortMethod=${sortMethod}, ascending=${ascending}, offset=${offset}`);

   try{

      // Error checking just in case
      const validSortMethods = ["listen_count", "skip_count", "minutes_listened"];
      if( !validSortMethods.includes(sortMethod) ){
         return res.status(400).json({error: "Invalid sort method"});
      }

      // Get total count for pagination info
      // Will help us in knowing when we can show the load more button
      const { count, error: countError } = await supabase
         .from("Track Interactions")
         .select('*', { count: 'exact', head: true })
         .eq("user_id", userId);

      if (countError) {
         console.error("Error getting track count:", countError);
         return res.status(500).json({ error: "Error fetching track count" });
      }

      // Get top tracks with stats
      // The select statement is basically doing: for each track interaction, also fetch the related track information
      // Have to do this because track interactions table doesnt have information regarding track, only stats for that track
      const { data: trackData, error: trackError } = await supabase
         .from("Track Interactions")
         .select(`
            track_id,
            listen_count,
            skip_count,
            minutes_listened,
            Tracks (
               track_name,
               artist,
               album_image
            )
         `)
         .eq("user_id", userId)
         .order(sortMethod, {ascending: ascending})
         .range(offset, offset + 49);

      if( trackError ){
         console.error("Error fetching track stats:", trackError);
         return res.status(500).json({error: "Error fetching track stats"});
      }

      // Format the data to match the structure expected by front end
      const formattedTracks = {
         items: trackData.map(item => ({
            id: item["track_id"],
            name: item["Tracks"]["track_name"],
            artists: [{ name: item["Tracks"]["artist"] }],
            album: {
               images: [{ url: item["Tracks"]["album_image"] }]
            },
            stats: {
               listen_count: item["listen_count"],
               skip_count: item["skip_count"],
               minutes_listened: item["minutes_listened"]
            }
         }))
      };

      // Return the formatted tracks
      res.json({
         tracks: formattedTracks,
         pagination: {
            total: count,
            offset: offset,
            limit: 50,
            hasMore: offset + 50 < count
         }
      });

   } catch (error) {
      console.error("Error fetching lifetime stats");
      res.status(500).json({error: "Internal server error"});
   }
});

const PORT = 3000;
app.listen(PORT, () => {
   console.log(`Server running on http://localhost:${PORT}`);
});