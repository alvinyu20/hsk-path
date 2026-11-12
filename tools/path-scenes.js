/* Draws the scenes of the themed Learn path (HSK 1 a day in a city, HSK 2 the rail line, HSK 3 a semester in Hangzhou) as 600x240 SVG pictures
 * and writes them to data/path-scenes.js as data URIs (window.SHANLU_PATH_SCENES). No text is drawn inside the pictures (an <img> cannot load the site's fonts).
 *   node tools/path-scenes.js */
const fs = require('fs');
const path = require('path');
const W = 600, H = 240;
const svg = (inner, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${defs ? '<defs>' + defs + '</defs>' : ''}${inner}</svg>`;
const grad = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const person = (x, y, body, hair, s = 1, skin = '#F0C9A0') => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-17 52q0-26 17-26t17 26v6h-34z" fill="${body}"/><circle cx="0" cy="12" r="12" fill="${skin}"/><path d="M-13 10q1-15 13-15t13 15q-7-7-13-7t-13 7z" fill="${hair}"/><circle cx="-4" cy="14" r="1.5" fill="#14212A"/><circle cx="4" cy="14" r="1.5" fill="#14212A"/><path d="M-3 19q3 2.5 6 0" stroke="#14212A" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`;
const lantern = (x, y, c = '#C2362B', s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0-14v8" stroke="#14212A" stroke-width="2"/><ellipse cx="0" cy="6" rx="11" ry="13" fill="${c}"/><path d="M-4-6q-4 12 0 24M4-6q4 12 0 24" stroke="#8E1F18" stroke-width="1.2" fill="none"/><rect x="-5" y="-7" width="10" height="3" fill="#E9B44C"/><rect x="-5" y="18" width="10" height="3" fill="#E9B44C"/><path d="M0 21v8" stroke="#E9B44C" stroke-width="2"/></g>`;
const cloud = (x, y, s = 1, c = '#fff', o = 0.9) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}" opacity="${o}"><ellipse cx="0" cy="0" rx="26" ry="9"/><ellipse cx="-12" cy="-6" rx="14" ry="9"/><ellipse cx="10" cy="-8" rx="16" ry="10"/></g>`;
const tree = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="20" width="4" height="12" fill="#6B4E3A"/><path d="M0-6-14 14h28z" fill="${c}"/><path d="M0-22-11-2h22z" fill="${c}"/></g>`;

const S = {};

// HSK 1 morning: a train at a station at dawn
S['day-arrive'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="110" cy="150" r="40" fill="#EE9B54"/>
<path d="M0 150h26v-34h30v34h20v-56h36v56h28v-26h30v26h50v-42h28v42h70v-30h30v30h60v-44h34v44h60v-20h32v20h46v40H0z" fill="#D9BF9F" opacity=".85"/>
<g fill="#B8A07F" opacity=".7"><rect x="40" y="128" width="8" height="8"/><rect x="108" y="108" width="8" height="8"/><rect x="108" y="126" width="8" height="8"/><rect x="214" y="124" width="8" height="8"/><rect x="330" y="120" width="8" height="8"/><rect x="440" y="116" width="8" height="8"/></g>
<rect y="178" width="${W}" height="62" fill="#B79F86"/><rect y="178" width="${W}" height="5" fill="#8E7860"/><rect y="226" width="${W}" height="3" fill="#8E7860" opacity=".6"/>
<rect x="430" y="76" width="150" height="104" fill="#E6D3B8"/><path d="M420 78h170l-14-22H434z" fill="#C2362B"/><rect x="458" y="92" width="94" height="30" rx="3" fill="#1D6B58"/><g fill="#fff"><rect x="474" y="100" width="62" height="4"/><rect x="474" y="109" width="40" height="4"/></g><rect x="446" y="132" width="26" height="48" fill="#A9855E"/><rect x="540" y="132" width="26" height="48" fill="#A9855E"/>
<rect x="14" y="128" width="332" height="58" rx="12" fill="#F8FAF7" stroke="#14212A" stroke-width="2.5"/><rect x="14" y="160" width="332" height="9" fill="#C2362B"/>
<g fill="#A9CBE8" stroke="#14212A" stroke-width="1.8"><rect x="30" y="138" width="40" height="22" rx="4"/><rect x="84" y="138" width="40" height="22" rx="4"/><rect x="138" y="138" width="40" height="22" rx="4"/><rect x="192" y="138" width="40" height="22" rx="4"/><rect x="246" y="138" width="40" height="22" rx="4"/><rect x="298" y="138" width="36" height="22" rx="4"/></g>
<circle cx="64" cy="190" r="7" fill="#14212A"/><circle cx="170" cy="190" r="7" fill="#14212A"/><circle cx="280" cy="190" r="7" fill="#14212A"/>
${person(396, 150, '#C2362B', '#14212A', .9)}<path d="M412 168l16-16" stroke="#F0C9A0" stroke-width="6" stroke-linecap="round"/>
${cloud(250, 44, 1.2)}${cloud(40, 70, .8)}`, grad('sk', '#F6C99B', '#FCEBD3'));

// HSK 1 noon: a food street with a steaming stall
S['day-lunch'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="500" cy="52" r="30" fill="#F7D054"/>
<path d="M0 140h60v-48h50v48h40v-70h58v70h40v-36h50v36h60v-58h54v58h50v-40h60v40h78v100H0z" fill="#E8C9A0"/>
<g fill="#C2362B"><rect x="80" y="100" width="24" height="26" rx="2"/><rect x="226" y="86" width="26" height="30" rx="2"/><rect x="410" y="100" width="24" height="26" rx="2"/></g>
<rect y="190" width="${W}" height="50" fill="#C9B08E"/><rect y="190" width="${W}" height="4" fill="#A58B68"/>
<g><rect x="120" y="120" width="190" height="72" fill="#8A4300"/><path d="M104 124h222l-18-34H122z" fill="#C2362B"/><path d="M122 90 140 124M158 90 168 124M194 90 196 124M230 90 224 124M266 90 252 124M302 90 280 124" stroke="#F8FAF7" stroke-width="5" opacity=".9"/>
<rect x="132" y="150" width="166" height="8" fill="#6B3300"/>
<ellipse cx="170" cy="146" rx="26" ry="9" fill="#F8FAF7" stroke="#14212A" stroke-width="2"/><path d="M148 146q22 22 44 0z" fill="#fff" stroke="#14212A" stroke-width="2"/>
<ellipse cx="250" cy="146" rx="26" ry="9" fill="#F8FAF7" stroke="#14212A" stroke-width="2"/><path d="M228 146q22 22 44 0z" fill="#fff" stroke="#14212A" stroke-width="2"/>
<g stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"><path d="M162 130q-8-10 0-18t0-14"/><path d="M178 130q-8-10 0-18t0-14"/><path d="M242 130q-8-10 0-18t0-14"/><path d="M258 130q-8-10 0-18t0-14"/></g></g>
${person(360, 160, '#1D6B58', '#14212A', 1)}${person(412, 164, '#E9A24B', '#6B4E3A', .95)}${person(80, 164, '#6A8FB5', '#14212A', .95)}
${lantern(40, 40, '#C2362B', .9)}${lantern(560, 118, '#C2362B', .8)}${cloud(300, 36, 1.1)}`, grad('sk', '#BFE0F0', '#EAF5F7'));

// HSK 1 afternoon: a school gate with trees and bikes
S['day-afternoon'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="90" cy="48" r="26" fill="#F9DC7C"/>
<path d="M0 156q80-34 160-10t170 0 140-16 130 12v98H0z" fill="#9CCDB2"/>
<rect y="196" width="${W}" height="44" fill="#CDBB9B"/>
<rect x="226" y="96" width="180" height="104" fill="#EBDCC0"/><rect x="214" y="84" width="204" height="18" fill="#C2362B"/><path d="M204 86h224l-22-26H226z" fill="#8E1F18"/><path d="M226 60h180" stroke="#E9B44C" stroke-width="3"/>
<rect x="288" y="130" width="56" height="70" fill="#5C4333"/><rect x="316" y="130" width="2" height="70" fill="#3A2A20"/><circle cx="296" cy="168" r="3" fill="#E9B44C"/><circle cx="336" cy="168" r="3" fill="#E9B44C"/>
<g fill="#A9CBE8" stroke="#14212A" stroke-width="1.6"><rect x="238" y="112" width="30" height="24" rx="3"/><rect x="364" y="112" width="30" height="24" rx="3"/></g>
${tree(60, 142, 1.5, '#2C735F')}${tree(150, 150, 1.2, '#3C8670')}${tree(500, 142, 1.5, '#2C735F')}${tree(556, 152, 1.1, '#3C8670')}
<g stroke="#14212A" stroke-width="3" fill="none"><circle cx="440" cy="214" r="13"/><circle cx="480" cy="214" r="13"/><path d="M440 214l14-26h18M480 214l-10-26M454 188l-4-8h-8"/></g>
${person(170, 168, '#C2362B', '#14212A', .95)}${person(206, 172, '#6A8FB5', '#6B4E3A', .9)}
${cloud(420, 40, 1.3)}${cloud(260, 30, .8)}`, grad('sk', '#B9E0EE', '#F4F9F5'));

// HSK 1 evening: lanterns over a night street
S['day-evening'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="520" cy="46" r="20" fill="#F8E4CB"/><circle cx="530" cy="40" r="18" fill="#2A4260"/>
<g fill="#fff" opacity=".9"><circle cx="60" cy="34" r="1.6"/><circle cx="140" cy="60" r="1.4"/><circle cx="220" cy="24" r="1.8"/><circle cx="310" cy="50" r="1.4"/><circle cx="400" cy="28" r="1.6"/><circle cx="470" cy="70" r="1.4"/></g>
<path d="M0 156h50v-50h50v50h40v-72h56v72h40v-44h50v44h50v-64h56v64h46v-40h52v40h50v-52h56v52h54v90H0z" fill="#27394F"/>
<g fill="#F9D78A"><rect x="64" y="122" width="14" height="14"/><rect x="164" y="104" width="14" height="14"/><rect x="164" y="132" width="14" height="14"/><rect x="262" y="124" width="14" height="14"/><rect x="354" y="108" width="14" height="14"/><rect x="354" y="136" width="14" height="14"/><rect x="448" y="128" width="14" height="14"/><rect x="540" y="116" width="14" height="14"/></g>
<rect y="196" width="${W}" height="44" fill="#3B2F2A"/><rect y="196" width="${W}" height="3" fill="#6B554A"/>
<path d="M0 66Q150 110 300 80T600 74" fill="none" stroke="#14212A" stroke-width="2.5"/>
${lantern(60, 94, '#C2362B', 1.1)}${lantern(150, 108, '#E9A24B', 1)}${lantern(240, 104, '#C2362B', 1.1)}${lantern(330, 90, '#E9A24B', 1)}${lantern(420, 88, '#C2362B', 1.1)}${lantern(510, 84, '#E9A24B', 1)}
<g opacity=".28" fill="#F9D78A"><ellipse cx="120" cy="214" rx="70" ry="10"/><ellipse cx="320" cy="214" rx="90" ry="10"/><ellipse cx="500" cy="214" rx="70" ry="10"/></g>
${person(190, 160, '#E9A24B', '#14212A', 1)}${person(240, 164, '#1D6B58', '#14212A', .95)}${person(400, 162, '#C2362B', '#6B4E3A', 1)}${person(450, 166, '#6A8FB5', '#14212A', .9)}`, grad('sk', '#16243A', '#4A5F82'));

// HSK 2: a night train on a line through hills
S['rail-hero'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/>
<g fill="#fff" opacity=".85"><circle cx="40" cy="30" r="1.6"/><circle cx="120" cy="56" r="1.4"/><circle cx="200" cy="22" r="1.8"/><circle cx="300" cy="46" r="1.4"/><circle cx="380" cy="26" r="1.6"/><circle cx="470" cy="60" r="1.4"/><circle cx="560" cy="30" r="1.6"/></g>
<circle cx="500" cy="52" r="22" fill="#F8E4CB"/>
<path d="M0 150Q60 90 130 130T270 112T420 134T600 100V240H0z" fill="#2B4A55"/>
<path d="M0 182Q100 140 210 168T400 160T600 150V240H0z" fill="#1F3A44"/>
<g fill="#F9D78A"><rect x="70" y="150" width="6" height="6"/><rect x="82" y="152" width="6" height="6"/><rect x="330" y="146" width="6" height="6"/><rect x="520" y="130" width="6" height="6"/></g>
<rect x="0" y="196" width="${W}" height="8" fill="#14212A"/><g fill="#6B554A">${Array.from({ length: 30 }, (_, i) => `<rect x="${i * 22 - 4}" y="204" width="12" height="6"/>`).join('')}</g><rect x="0" y="212" width="${W}" height="28" fill="#14212A"/>
<g><path d="M60 196v-44q0-14 14-14h300q24 0 34 14l20 20v24z" fill="#F8FAF7"/><path d="M60 176h428v8H60z" fill="#C2362B"/><path d="M60 196h428v4H60z" fill="#14212A" opacity=".4"/>
<g fill="#F9D78A" stroke="#14212A" stroke-width="1.5"><rect x="84" y="152" width="38" height="18" rx="3"/><rect x="134" y="152" width="38" height="18" rx="3"/><rect x="184" y="152" width="38" height="18" rx="3"/><rect x="234" y="152" width="38" height="18" rx="3"/><rect x="284" y="152" width="38" height="18" rx="3"/><rect x="334" y="152" width="38" height="18" rx="3"/><rect x="424" y="152" width="32" height="14" rx="3" fill="#A9CBE8"/></g>
<circle cx="110" cy="200" r="7" fill="#14212A"/><circle cx="250" cy="200" r="7" fill="#14212A"/><circle cx="400" cy="200" r="7" fill="#14212A"/></g>
<path d="M488 188l50 0" stroke="#F9D78A" stroke-width="3" opacity=".6"/><path d="M488 182l90 18v-10z" fill="#F9D78A" opacity=".25"/>`, grad('sk', '#0E1920', '#33566A'));

// HSK 3: autumn at the lake, a willow and a bridge
S['story-autumn'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="470" cy="62" r="30" fill="#EE9B54"/>
<path d="M0 118 80 78 160 108 250 66 340 112 430 82 520 110 600 90V150H0z" fill="#E6BE8B"/>
<path d="M0 134 90 104 190 130 290 100 400 132 500 112 600 128V160H0z" fill="#CDA070" opacity=".6"/>
<rect y="140" width="${W}" height="100" fill="#8FB8B0"/><path d="M0 146h600" stroke="#B9D6CF" stroke-width="2"/>
<path d="M120 164q8-5 16 0M230 186q8-5 16 0M60 204q8-5 16 0M400 200q8-5 16 0" stroke="#D2E7DE" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M250 142q60-52 120 0" fill="none" stroke="#14212A" stroke-width="4"/><path d="M240 142h140" stroke="#14212A" stroke-width="6"/><path d="M256 142v14M296 142v14M344 142v14M370 142v14" stroke="#14212A" stroke-width="3"/>
<rect x="70" y="70" width="10" height="100" fill="#6B4E3A"/>
<g fill="none" stroke="#C08A3E" stroke-width="3.4" stroke-linecap="round"><path d="M75 72Q28 78 30 150"/><path d="M75 72Q44 86 46 160"/><path d="M75 72Q96 90 94 154"/><path d="M75 72Q124 76 126 142"/><path d="M75 72Q146 66 150 124"/></g>
<g fill="#E8A24B"><circle cx="30" cy="154" r="3.4"/><circle cx="46" cy="164" r="3.4"/><circle cx="94" cy="158" r="3.4"/><circle cx="126" cy="146" r="3.4"/><circle cx="150" cy="128" r="3.4"/></g>
<path d="M0 214Q200 188 600 220V240H0z" fill="#C89A5E"/>
<g fill="#E8A24B" opacity=".9"><path d="M300 30l6 4-4 6-6-4z"/><path d="M360 60l6 4-4 6-6-4z"/><path d="M200 50l6 4-4 6-6-4z"/><path d="M540 140l6 4-4 6-6-4z"/></g>
${person(440, 160, '#C2362B', '#14212A', 1.1)}${person(500, 166, '#1D6B58', '#6B4E3A', 1.05)}`, grad('sk', '#F2C285', '#FBE9C8'));

// HSK 3: winter, snow on the bridge
S['story-winter'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="480" cy="58" r="26" fill="#fff" opacity=".7"/>
<path d="M0 118 80 78 160 108 250 66 340 112 430 82 520 110 600 90V150H0z" fill="#D6E1EA"/><path d="M80 78 58 96 78 90 94 104z" fill="#fff"/><path d="M250 66 224 88 246 82 266 96z" fill="#fff"/>
<rect y="140" width="${W}" height="100" fill="#A9C2D2"/><path d="M0 146h600" stroke="#D5E3EC" stroke-width="2"/>
<path d="M250 142q60-52 120 0" fill="none" stroke="#14212A" stroke-width="4"/><path d="M240 142h140" stroke="#14212A" stroke-width="6"/><path d="M240 136h140" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M252 138q58-50 116 0" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
<rect x="70" y="80" width="9" height="92" fill="#5C4333"/>
<g fill="none" stroke="#5C4333" stroke-width="3" stroke-linecap="round"><path d="M74 90 40 60M74 100 118 66M74 118 36 98M74 124 120 108M40 60l-10-4M118 66l8-10"/></g>
<g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"><path d="M44 62 36 56M110 70l8-6M44 104l-6-4M110 112l8-4"/></g>
<path d="M0 214Q200 190 600 220V240H0z" fill="#F4F8FA"/>
<g fill="#fff"><circle cx="30" cy="30" r="2.6"/><circle cx="120" cy="50" r="2.2"/><circle cx="190" cy="24" r="2.8"/><circle cx="310" cy="40" r="2.2"/><circle cx="390" cy="20" r="2.6"/><circle cx="560" cy="48" r="2.4"/><circle cx="450" cy="96" r="2.2"/><circle cx="520" cy="20" r="2.2"/><circle cx="90" cy="130" r="2.4"/></g>
${person(440, 160, '#C2362B', '#14212A', 1.1)}<path d="M426 172q14 8 28 0" stroke="#fff" stroke-width="5" fill="none"/>${person(500, 166, '#1D6B58', '#6B4E3A', 1.05)}<path d="M487 178q13 8 26 0" stroke="#E9A24B" stroke-width="5" fill="none"/>`, grad('sk', '#C9D8E6', '#EEF3F7'));

// HSK 3: spring blossom by the water
S['story-spring'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="500" cy="50" r="26" fill="#FBE18A"/>
<path d="M0 118 80 82 160 108 250 70 340 112 430 86 520 110 600 92V150H0z" fill="#B9D9CE"/>
<path d="M0 134 90 108 190 130 290 104 400 132 500 114 600 128V160H0z" fill="#86BBA6" opacity=".7"/>
<rect y="146" width="${W}" height="94" fill="#9ED0D8"/><path d="M0 152h600" stroke="#D8EEF0" stroke-width="2"/>
<path d="M250 148q60-52 120 0" fill="none" stroke="#14212A" stroke-width="4"/><path d="M240 148h140" stroke="#14212A" stroke-width="6"/><path d="M256 148v14M296 148v14M344 148v14M370 148v14" stroke="#14212A" stroke-width="3"/>
<rect x="76" y="84" width="10" height="92" fill="#6B4E3A"/>
<g fill="#F7B6C6"><circle cx="50" cy="66" r="26"/><circle cx="86" cy="52" r="30"/><circle cx="122" cy="68" r="26"/><circle cx="74" cy="86" r="24"/><circle cx="104" cy="90" r="22"/></g>
<g fill="#FBD3DD"><circle cx="64" cy="58" r="9"/><circle cx="102" cy="64" r="10"/><circle cx="84" cy="80" r="8"/></g>
<g fill="#F7B6C6" opacity=".95"><circle cx="150" cy="150" r="3"/><circle cx="170" cy="170" r="3"/><circle cx="130" cy="186" r="3"/><circle cx="200" cy="140" r="3"/><circle cx="40" cy="170" r="3"/></g>
<path d="M0 216Q200 192 600 222V240H0z" fill="#7DB56C"/>
<g fill="#F7B6C6"><circle cx="30" cy="224" r="3"/><circle cx="90" cy="230" r="3"/><circle cx="330" cy="224" r="3"/><circle cx="470" cy="230" r="3"/></g>
${person(440, 160, '#C2362B', '#14212A', 1.1)}${person(500, 166, '#1D6B58', '#6B4E3A', 1.05)}`, grad('sk', '#D9F0F7', '#F5FBF3'));

// HSK 1 header: the whole day in one sky, dawn on the left to night on the right
S['day-hero'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/>
<circle cx="70" cy="150" r="26" fill="#EE9B54"/><circle cx="230" cy="52" r="24" fill="#F7D054"/><circle cx="380" cy="122" r="22" fill="#E8793B"/><circle cx="548" cy="52" r="17" fill="#F8E4CB"/><circle cx="557" cy="46" r="15" fill="#2A4260"/>
<g fill="#fff" opacity=".9"><circle cx="440" cy="30" r="1.6"/><circle cx="480" cy="70" r="1.4"/><circle cx="520" cy="26" r="1.8"/><circle cx="580" cy="86" r="1.4"/><circle cx="465" cy="104" r="1.4"/></g>
${cloud(150, 70, 1)}${cloud(300, 34, .8)}
<path d="M0 190h30v-34h26v34h20v-52h32v52h26v-26h28v26h40v-44h30v44h30v-30h26v30h44v-54h34v54h28v-24h28v24h34v-40h30v40h36v-28h38v28H600v50H0z" fill="#3D5266" opacity=".92"/>
<g fill="#F9D78A"><rect x="38" y="164" width="7" height="7"/><rect x="100" y="150" width="7" height="7"/><rect x="190" y="166" width="7" height="7"/><rect x="300" y="154" width="7" height="7"/><rect x="396" y="150" width="7" height="7"/><rect x="424" y="164" width="7" height="7"/><rect x="498" y="160" width="7" height="7"/><rect x="566" y="168" width="7" height="7"/></g>
<rect y="206" width="${W}" height="34" fill="#2A3A4B"/>
${lantern(430, 190, '#C2362B', .7)}${lantern(500, 192, '#E9A24B', .7)}${lantern(570, 190, '#C2362B', .7)}`,
  '<linearGradient id="sk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F6C99B"/><stop offset=".3" stop-color="#BFE0F0"/><stop offset=".58" stop-color="#F0B46E"/><stop offset=".78" stop-color="#4A5F82"/><stop offset="1" stop-color="#16243A"/></linearGradient>');

// HSK 3 header: one lake, three seasons side by side
S['story-hero'] = svg(`
<rect width="${W}" height="${H}" fill="url(#sk)"/>
<circle cx="90" cy="54" r="24" fill="#EE9B54"/><circle cx="300" cy="50" r="20" fill="#fff" opacity=".75"/><circle cx="510" cy="50" r="22" fill="#FBE18A"/>
<path d="M0 118 80 84 160 110 250 74 340 112 430 88 520 112 600 94V150H0z" fill="url(#hl)"/>
<rect y="146" width="${W}" height="94" fill="url(#lk)"/>
<path d="M210 150q90-70 180 0" fill="none" stroke="#14212A" stroke-width="5"/><path d="M200 150h200" stroke="#14212A" stroke-width="7"/><path d="M216 150v16M262 150v16M338 150v16M384 150v16" stroke="#14212A" stroke-width="3"/><path d="M214 143q86-62 172 0" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
<rect x="46" y="84" width="9" height="90" fill="#6B4E3A"/>
<g fill="none" stroke="#C08A3E" stroke-width="3.2" stroke-linecap="round"><path d="M50 86Q8 92 10 156"/><path d="M50 86Q26 100 28 166"/><path d="M50 86Q70 102 68 160"/><path d="M50 86Q92 90 94 148"/></g>
<rect x="296" y="96" width="8" height="76" fill="#5C4333"/><g fill="none" stroke="#5C4333" stroke-width="3" stroke-linecap="round"><path d="M300 104 270 76M300 114 334 84M300 130 266 112M300 134 336 118"/></g>
<rect x="540" y="86" width="9" height="88" fill="#6B4E3A"/><g fill="#F7B6C6"><circle cx="520" cy="72" r="22"/><circle cx="548" cy="60" r="26"/><circle cx="576" cy="74" r="22"/><circle cx="540" cy="90" r="20"/></g><g fill="#FBD3DD"><circle cx="534" cy="64" r="8"/><circle cx="562" cy="70" r="8"/></g>
<path d="M0 216Q150 196 300 214T600 216V240H0z" fill="url(#gr)"/>
<g fill="#fff"><circle cx="228" cy="30" r="2.4"/><circle cx="330" cy="22" r="2.2"/><circle cx="370" cy="64" r="2.2"/><circle cx="262" cy="70" r="2"/></g>`,
  '<linearGradient id="sk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F2C285"/><stop offset=".33" stop-color="#F6D5A8"/><stop offset=".4" stop-color="#C9D8E6"/><stop offset=".62" stop-color="#EEF3F7"/><stop offset=".7" stop-color="#D9F0F7"/><stop offset="1" stop-color="#F5FBF3"/></linearGradient>' +
  '<linearGradient id="hl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E6BE8B"/><stop offset=".36" stop-color="#E0BE95"/><stop offset=".44" stop-color="#D6E1EA"/><stop offset=".62" stop-color="#D6E1EA"/><stop offset=".7" stop-color="#B9D9CE"/><stop offset="1" stop-color="#B9D9CE"/></linearGradient>' +
  '<linearGradient id="lk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8FB8B0"/><stop offset=".36" stop-color="#8FB8B0"/><stop offset=".46" stop-color="#A9C2D2"/><stop offset=".62" stop-color="#A9C2D2"/><stop offset=".72" stop-color="#9ED0D8"/><stop offset="1" stop-color="#9ED0D8"/></linearGradient>' +
  '<linearGradient id="gr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C89A5E"/><stop offset=".36" stop-color="#C89A5E"/><stop offset=".46" stop-color="#F4F8FA"/><stop offset=".62" stop-color="#F4F8FA"/><stop offset=".72" stop-color="#7DB56C"/><stop offset="1" stop-color="#7DB56C"/></linearGradient>');

const out = {};
Object.keys(S).forEach(k => { out[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(S[k]); });
const text = '/* Scenes of the themed Learn path. GENERATED by tools/path-scenes.js. Do not edit by hand. */\nwindow.SHANLU_PATH_SCENES = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'data', 'path-scenes.js'), text);
if (process.argv.includes('--svg')) Object.keys(S).forEach(k => fs.writeFileSync('/tmp/scene-' + k + '.svg', S[k]));
console.log('wrote data/path-scenes.js (' + Object.keys(S).length + ' scenes, ' + Math.round(text.length / 1024) + ' KB)');
