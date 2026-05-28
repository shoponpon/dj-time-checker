import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

// Interfaces for Rekordbox XML structure
interface PositionMark {
  Name?: string;
  Type?: string | number;
  Start?: string | number;
  Num?: string | number;
  [key: string]: any;
}

interface Track {
  TrackID: string | number;
  Name: string;
  Artist?: string;
  POSITION_MARK?: PositionMark | PositionMark[];
  [key: string]: any;
}

interface PlaylistTrack {
  Key: string | number;
}

interface PlaylistNode {
  Type: string | number;
  Name?: string;
  TRACK?: PlaylistTrack | PlaylistTrack[];
  NODE?: PlaylistNode | PlaylistNode[];
}

interface Collection {
  Entries?: string | number;
  TRACK?: Track | Track[];
}

interface Playlists {
  NODE?: PlaylistNode | PlaylistNode[];
}

interface DJPlaylists {
  COLLECTION?: Collection;
  PLAYLISTS?: Playlists;
}

interface XMLRoot {
  DJ_PLAYLISTS?: DJPlaylists;
}

// Helper to ensure we have an array, since XML parser returns single object or array
function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

// Helper to format duration in seconds to MM:SS.mmm or HH:MM:SS.mmm
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  const pad = (num: number, size = 2) => String(num).padStart(size, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

// Main execution function
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || !args[0]) {
    console.error('Error: Please specify the path to the Rekordbox XML file.');
    console.log('Usage: npx ts-node src/index.ts <path-to-rekordbox-xml>');
    return;
  }

  const xmlPath = path.resolve(args[0]);
  if (!fs.existsSync(xmlPath)) {
    console.error(`Error: File not found at ${xmlPath}`);
    return;
  }

  console.log(`Reading file: ${xmlPath}`);
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');

  // Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true, // Auto convert numbers and booleans
  });

  let parsed: XMLRoot = {};
  try {
    parsed = parser.parse(xmlContent);
  } catch (err: any) {
    console.error('Error: Failed to parse XML file. Please ensure it is a valid XML.', err.message);
    return;
  }

  const djPlaylists = parsed.DJ_PLAYLISTS;
  if (!djPlaylists) {
    console.error('Error: Invalid Rekordbox XML format. Root <DJ_PLAYLISTS> not found.');
    return;
  }

  // Create track lookup map by TrackID
  const trackMap = new Map<string, Track>();
  const rawTracks = ensureArray(djPlaylists.COLLECTION?.TRACK);

  for (const track of rawTracks) {
    if (track && track.TrackID !== undefined) {
      trackMap.set(String(track.TrackID), track);
    }
  }

  if (trackMap.size === 0) {
    console.warn('Warning: No tracks found in the collection.');
  }

  // Traverse playlists to collect tracks in playlist order if available,
  // or fall back to collection order if no playlist tracks are resolved.
  const orderedTrackIds: string[] = [];
  
  function collectTrackIdsFromPlaylists(node: PlaylistNode) {
    // If it's a playlist node (Type === 1 or contains TRACKs)
    const tracks = ensureArray(node.TRACK);
    for (const t of tracks) {
      if (t.Key !== undefined) {
        orderedTrackIds.push(String(t.Key));
      }
    }
    // Traverse nested nodes
    const children = ensureArray(node.NODE);
    for (const child of children) {
      collectTrackIdsFromPlaylists(child);
    }
  }

  const playlistsNode = djPlaylists.PLAYLISTS;
  if (playlistsNode) {
    const rootNodes = ensureArray(playlistsNode.NODE);
    for (const rootNode of rootNodes) {
      collectTrackIdsFromPlaylists(rootNode);
    }
  }

  // Determine final list of tracks to process
  let tracksToProcess: Track[] = [];
  if (orderedTrackIds.length > 0) {
    console.log(`Found ${orderedTrackIds.length} tracks across playlist(s). Processing in playlist order...`);
    for (const id of orderedTrackIds) {
      const track = trackMap.get(id);
      if (track) {
        tracksToProcess.push(track);
      }
    }
  } else {
    console.log(`No playlists found. Processing all ${trackMap.size} tracks from the collection...`);
    tracksToProcess = Array.from(trackMap.values());
  }

  let totalDuration = 0;
  let processedCount = 0;
  let skippedCount = 0;

  console.log('\n--- Processing Track HOTCUEs ---');
  console.log(''.padEnd(80, '-'));

  for (const track of tracksToProcess) {
    const trackName = track.Name || 'Unknown Track';
    const artist = track.Artist || 'Unknown Artist';
    const marks = ensureArray(track.POSITION_MARK);

    // Find HOTCUE A (Num="0") and C (Num="2")
    let hotcueA: PositionMark | undefined;
    let hotcueC: PositionMark | undefined;

    for (const mark of marks) {
      // Rekordbox Hot Cues have Type="0" and Num representing the hot cue (0: A, 1: B, 2: C, etc.)
      // In some exports, Num might be parsed as string or number. Let's handle both.
      const num = Number(mark.Num);
      const type = Number(mark.Type);

      if (type === 0) {
        if (num === 0) {
          hotcueA = mark;
        } else if (num === 2) {
          hotcueC = mark;
        }
      }
    }

    if (hotcueA && hotcueC) {
      const startA = Number(hotcueA.Start);
      const startC = Number(hotcueC.Start);

      if (!isNaN(startA) && !isNaN(startC)) {
        const diff = Math.abs(startC - startA);
        totalDuration += diff;
        processedCount++;

        console.log(`[PASS] ${artist} - ${trackName}`);
        console.log(`       HOTCUE A: ${formatDuration(startA)} (${startA}s)`);
        console.log(`       HOTCUE C: ${formatDuration(startC)} (${startC}s)`);
        console.log(`       Interval: ${formatDuration(diff)} (${diff.toFixed(3)}s)`);
        console.log(''.padEnd(80, '-'));
      } else {
        skippedCount++;
        console.log(`[SKIP] ${artist} - ${trackName} (Invalid HOTCUE start values)`);
        console.log(''.padEnd(80, '-'));
      }
    } else {
      skippedCount++;
      const missing = [];
      if (!hotcueA) missing.push('HOTCUE A');
      if (!hotcueC) missing.push('HOTCUE C');
      console.log(`[SKIP] ${artist} - ${trackName} (Missing: ${missing.join(', ')})`);
      console.log(''.padEnd(80, '-'));
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total Tracks Processed: ${processedCount}`);
  console.log(`Total Tracks Skipped:   ${skippedCount}`);
  console.log(`Total Combined Time (A to C): ${formatDuration(totalDuration)} (${totalDuration.toFixed(3)} seconds)`);
}

main();
