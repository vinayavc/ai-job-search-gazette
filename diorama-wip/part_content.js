  const SIGNS = [
    { word: 'GAZETTE PRESS', at: [-3.2, -2.9], h: 2.85 },
    { word: 'YOUR HOUSE', at: [0.95, -0.95], h: 2.55 },
    { word: 'HIRING OFFICE', at: [5.15, -3.0], h: 3.05 },
  ];
  const TILE = { w: 12.6, d: 8.2, r: 1.0 }, FLOOR = -3.5;
  // the road leaves the press at the back left, swings forward past your house and climbs to the office at the back right
  const ROAD = [[-2.3, -1.7], [-1.2, -1.7], [-0.3, -1.45], [0.15, -0.75], [0.05, 0.3], [-0.1, 1.3], [0.35, 2.2], [1.3, 2.68], [2.5, 2.72], [3.4, 2.5], [3.9, 1.75], [3.75, 0.7], [3.55, -0.05], [3.48, -0.4]];
  const PRESS = { x: -3.9, z: -1.8, w: 3.0, d: 3.2, h: 1.5 }, DOOR_Z = -1.7;
  const HOME = { x: 1.9, z: 0.3, w: 2.0, d: 1.8, h: 1.35 };   // front wall at z 1.2
  const OFFICE = { x: 4.7, z: -2.55, w: 2.3, d: 1.7 };
  const MAT = [1.9, 1.58];                 // the doormat where the dachshund naps
  const BOX = [0.85, 1.72];                // the letterbox at the left of the porch
  const TW = [2.86, 1.46];                 // the little typewriter at the right end of the step, keys facing the dog
  const SLOT = [4.72, 1.0, -1.66];         // the office door's mail slot

  const PAL = {
    backdrop: '#b4d2de', evening: '#7c8fbd', grass: '#9fc47c', leaf: ['#5fa574', '#3f866c', '#84ba6b'], trunk: '#8b5b3e',
    earth: ['#5c4135', '#8f6248', '#c9955f', '#7c7f8e'], stone: ['#a9a9b0', '#d9cdb8', '#8d8f9c'],
    cream: '#f6ebd8', slate: '#44718a', mustard: '#f0b040', accent: '#e9573f', glass: '#2c4658', dark: '#272b36',
    road: '#6e7080', kraft: '#cb9c68', skin: '#f2c8a2', smoke: '#ffffff', water: '#8fd0e0', lampGlow: '#ffc56e',
    dog: '#c47a3d', ear: '#7e4524', newsprint: '#f3eee2',
  };
  const FONT = '600 160px "Fredoka"';

  // ---------------------------------------------------------------- one schedule for picture and sound
  // In the app each stage plays its own beats: /scrape = 1-2, /rank = 3, /apply = 4 (then the flag stays up),
  // and 5-6 only after you confirm you applied on the job site.
  const T = {
    push: 0.3, inVan: 1.0, shut: 1.2, rollDown: [1.6, 2.3],      // 1: the Gazette rolls off the press into the van
    go1: 1.5, arrive1: 3.4,                                       // 2: drive to your house
    out1: 3.55, hop1: 3.8, drop: 4.12, back1: 4.3, inVan1: 4.6,   //    the mailman leaves it on the mat
    wake: 4.25, stand: 4.6, fetch: [4.72, 5.0], sit: 5.25, unroll: [5.3, 5.55],
    cards: [5.55, 5.7, 5.85], stamps: [6.05, 6.25, 6.45], ring: [6.75, 7.25], fall: [7.35, 7.6], toTW: [7.45, 7.9],   // 3: scored; you circle one
    toType: [7.65, 7.95], typing: [8.0, 9.15], pages: [8.1, 8.6], fold: [9.2, 9.45], grab: 9.5,                          // 4: the CV and letter get typed
    trot: [9.55, 10.05], rear: [10.05, 10.5], post: 10.32, flag: 10.4, home: [10.5, 10.95], nap: [10.95, 11.15],
    door: [11.3, 13.55], youOut: 11.4, you: [11.6, 11.85], take: 12.05, wave: [12.55, 12.8], youBack: [13.05, 13.3],     // 5: you send it
    out1b: 11.7, mail: [11.95, 12.2], hand: 12.36, mailBack: [12.5, 12.75], inVan2: 13.0,
    go2: 13.1, arrive2: 14.6,                                     // 6: delivered at dusk
    out2: 14.75, hops2: [14.95, 15.2], slot: 15.47, lamp: 14.7, lights: 15.67,
  };
  const FLIPS = [T.shut + 0.1, T.drop + 0.13, T.slot + 0.1];
  const BEATS = [
    { t0: 0, t1: 2.6, tag: 'FETCH', text: 'The Gazette goes to press' },
    { t0: 2.6, t1: 5.25, tag: 'FETCH', text: 'The mailman brings it to your door' },
    { t0: 5.25, t1: 7.6, tag: 'RANK', text: 'Scored for you. You circle your pick.' },
    { t0: 7.6, t1: 11.2, tag: 'TAILOR', text: 'Your pup types up your CV and letter' },
    { t0: 11.2, t1: 13.6, tag: 'YOU APPLY', text: 'You apply on the job site. Off it goes.' },
    { t0: 13.6, t1: 17.0, tag: 'SENT', text: 'Sent. Time for a nap.' },
  ];
  const DURATION = 17;

