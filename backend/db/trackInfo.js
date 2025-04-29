const supabase = require('../../lib/supabaseclient');

async function upsertTrack(trackData){
   const defaultImagePath = "http://localhost:8081/images/no_image_provided.png";

   // Make the track record, we can combine artist into a single string
   const trackRecord = {
      track_id: trackData['id'],
      track_name: trackData['name'],
      artist: Array.isArray(trackData['artists']) // checks to see if we have artists
         ? trackData['artists'].map(artist => artist['name']).join(', ')
         : 'Unknown',  // Fallback if no artist data is present
      album_image: trackData['album'] && trackData['album']['images'] // checks to make sure album property exists and that the album has an image, if either is false sets album image to null
         ? trackData['album']['images'][0]['url']
         : defaultImagePath,
   };
   
   // console.log(`Created track record: ${JSON.stringify(trackRecord)}`);

   // Use upsert to insert the track if it doesnt exist, or update if it already does. Using track_id as the key
   const { data, error } = await supabase
      .from('Tracks')
      .upsert(trackRecord, {onConflict: 'track_id', returning: 'representation' });

   // If there's an error and it's not a conflict
   if( error && error.code != 'PGRST116' ){
      return { error };
   }

   // Fetch the track record to test whether things got populated correctly, will probably remove later
   const { data: track, error: selectError } = await supabase
      .from('Tracks')
      .select('*')
      .eq('track_id', trackData.id)
      .single();

   if (selectError) {
   return { error: selectError };
   }

   return { track };
}

module.exports = { upsertTrack };