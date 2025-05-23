
// --- Global Variables ---
let playersData = [];
const draftPickValues = {
    '2025': { '1-early': 60, '1-mid': 55, '1-late': 50, '2-early': 40, '2-mid': 35, '2-late': 30, '3-early': 25, '3-mid': 20, '3-late': 15, '4': 10, '5': 5 },
    '2026': { '1-early': 55, '1-mid': 50, '1-late': 45, '2-early': 35, '2-mid': 30, '2-late': 25, '3-early': 20, '3-mid': 15, '3-late': 10, '4': 8, '5': 4 },
    '2027': { '1-early': 50, '1-mid': 45, '1-late': 40, '2-early': 30, '2-mid': 25, '2-late': 20, '3-early': 15, '3-mid': 10, '3-late': 8, '4': 6, '5': 3 },
};
let currentLeagueSettings = { leagueFormat: 'dynasty', leagueType: 'standard', pprScoring: 'standard', tePremium: 'none' };
let assetCounters = { yourPlayer: 1, yourPick: 1, theirPlayer: 1, theirPick: 1 };

// --- DOM Elements ---
let applySettingsBtn, leagueFormatSelect, leagueTypeSelect, pprScoringSelect, tePremiumSelect;
let messageBox, playerRankingsTableBody, analyzeTradeBtn, tradeResultDiv;
let yourAssetsContainer, theirAssetsContainer;
let topStartsList, topSitsList;


function calculatePlayerValue(player, settings) {
    let value = 0;
    value += parseFloat(player.nextYearPoints || 0) * 0.5;
    if (settings.leagueFormat === 'dynasty') {
        const playerAge = parseInt(player.age || 30);
        if (playerAge < 25) value += (25 - playerAge) * 2;
        else if (playerAge > 28) value -= (playerAge - 28) * 1.5;
        if (player.threeYearOutlook === 'elite') value += 15;
        else if (player.threeYearOutlook === 'high') value += 7;
        if (player.contractStatus === 'rookie' || playerAge < 23) {
            if (player.draftCapital && player.draftCapital.includes('1st_round')) value += 10;
            else if (player.draftCapital && player.draftCapital.includes('2nd_round')) value += 5;
        }
    } else if (settings.leagueFormat === 'redraft') {
        value += parseFloat(player.snapShare || 0) * 20;
        value += (parseInt(player.offenseRank || 16) / 32) * -10;
        const sos = parseInt(player.sosRank || 16);
        if (sos > 20) value += 7;
        else if (sos < 10) value -= 7;
    }
    if (settings.leagueType === 'superflex' && player.position === 'QB') value *= 1.5;
    const receptions = parseFloat(player.receptions || 0);
    if (settings.pprScoring === 'half-ppr') value += receptions * 0.5;
    else if (settings.pprScoring === 'full-ppr') value += receptions * 1.0;
    if (player.position === 'TE') {
        if (settings.tePremium === 'plus-05') value += receptions * 0.5;
        else if (settings.tePremium === 'plus-10') value += receptions * 1.0;
    }
    return Math.max(0, parseFloat(value.toFixed(1)));
}

function showMessage(message, type = 'info', duration = 3000) {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `mt-6 p-4 rounded-md text-center ${type === 'error' ? 'bg-red-700' : type === 'success' ? 'bg-green-700' : 'bg-blue-700'} text-white`;
    messageBox.style.display = 'block';
    setTimeout(() => { messageBox.style.display = 'none'; }, duration);
}

function updateAllPlayerRankings() {
    if (!playerRankingsTableBody || playersData.length === 0) {
        if(playerRankingsTableBody) playerRankingsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No player data.</td></tr>';
        return;
    }
    playersData.forEach(player => { 
        player.calculatedValue = calculatePlayerValue(player, currentLeagueSettings);
    });
    const rankedPlayers = [...playersData].sort((a, b) => b.calculatedValue - a.calculatedValue);
    playerRankingsTableBody.innerHTML = '';
    rankedPlayers.forEach((player, index) => {
        const row = playerRankingsTableBody.insertRow();
        row.className = 'hover:bg-gray-700 transition duration-150 ease-in-out';
        row.innerHTML = `<td class="px-4 py-4 text-sm font-medium text-white">${index + 1}</td><td class="px-4 py-4 text-sm text-gray-300">${player.name}</td><td class="px-4 py-4 text-sm text-gray-300">${player.position}</td><td class="px-4 py-4 text-sm text-gray-300">${player.team}</td><td class="px-4 py-4 text-sm text-gray-300">${player.age}</td><td class="px-4 py-4 text-sm text-yellow-400 font-bold">${player.calculatedValue}</td>`;
    });
}

function getDraftPickValue(year, round, designation = '') {
    if (currentLeagueSettings.leagueFormat === 'redraft' && year !== '2025') return 0;
    if (draftPickValues[year]) {
        let pickKey = round.toString();
        if (designation && (round === '1' || round === '2' || round === '3')) pickKey = `${round}-${designation}`;
        if (draftPickValues[year][pickKey]) return draftPickValues[year][pickKey];
    }
    return 0;
}

function getPlayerValueByName(playerName) {
    const player = playersData.find(p => p.name && p.name.toLowerCase() === playerName.toLowerCase());
    return player ? (player.calculatedValue !== undefined ? player.calculatedValue : calculatePlayerValue(player, currentLeagueSettings)) : 0;
}

function createAssetHTML(side, type, count, assetGroupId) {
    const uniqueSuffix = assetGroupId; 
    let html = `<div class="asset-item ${type}-asset space-y-2 mb-3 relative">`;
    if (type === 'player') {
        html += `<div><label for="playerInput_${uniqueSuffix}" class="block text-gray-300 text-sm font-semibold mb-1">Player ${count}:</label><input type="text" id="playerInput_${uniqueSuffix}" placeholder="Enter Player Name" class="trade-player-input w-full p-3 rounded-md bg-gray-600 border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-gold-500"></div>`;
    } else if (type === 'pick') {
        html += `<div><label class="block text-gray-300 text-sm font-semibold mb-1">Draft Pick <span class="pick-counter">${count}</span>:</label><div class="flex flex-wrap gap-2"><select id="pickYear_${uniqueSuffix}" class="trade-pick-year-select p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 flex-grow sm:flex-grow-0 sm:w-1/3"><option value="">Year</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option></select><select id="pickRound_${uniqueSuffix}" class="trade-pick-round-select p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 flex-grow sm:flex-grow-0 sm:w-1/3"><option value="">Round</option><option value="1">1st</option><option value="2">2nd</option><option value="3">3rd</option><option value="4">4th</option><option value="5">5th</option></select><select id="pickDesignation_${uniqueSuffix}" class="trade-pick-designation-select p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 flex-grow sm:flex-grow-0 sm:w-1/3" style="display: none;"><option value="">Overall</option><option value="early">Early</option><option value="mid">Mid</option><option value="late">Late</option></select></div></div>`;
    }
    html += `<button type="button" class="asset-remove-btn absolute top-1 right-1" title="Remove Asset" aria-label="Remove Asset">×</button></div>`;
    return html;
}

function addAsset(side, type) {
    const assetContainer = document.getElementById(`${side}Assets`);
    if (!assetContainer) return;
    const counterKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`;
    assetCounters[counterKey]++;
    const assetGroupId = `${side}_${type}_${Date.now()}_${assetCounters[counterKey]}`;
    const newAssetHTML = createAssetHTML(side, type, assetCounters[counterKey], assetGroupId);
    const newAssetElementWrapper = document.createElement('div');
    newAssetElementWrapper.innerHTML = newAssetHTML;
    const actualAssetDiv = newAssetElementWrapper.firstChild as HTMLElement; // Cast to HTMLElement
    assetContainer.appendChild(actualAssetDiv);
    // Fix for: Property 'querySelector' does not exist on type 'ChildNode'.
    const removeBtn = actualAssetDiv.querySelector('.asset-remove-btn');
    if (removeBtn) removeBtn.addEventListener('click', function() { (this as HTMLElement).closest('.asset-item').remove(); });
    if (type === 'pick') {
        // Fix for: Property 'querySelector' does not exist on type 'ChildNode'.
        const roundSelect = actualAssetDiv.querySelector('.trade-pick-round-select') as HTMLSelectElement;
        // Fix for: Property 'querySelector' does not exist on type 'ChildNode'.
        const designationSelect = actualAssetDiv.querySelector('.trade-pick-designation-select') as HTMLSelectElement;
        if (roundSelect && designationSelect) {
            roundSelect.addEventListener('change', function() {
                const selectedRound = this.value;
                if (selectedRound === '1' || selectedRound === '2' || selectedRound === '3') designationSelect.style.display = 'block';
                else { designationSelect.style.display = 'none'; designationSelect.value = ''; }
            });
        }
    }
}

function setupInitialPickDesignationListeners() {
    document.querySelectorAll('.pick-asset').forEach(pickDiv => {
        const roundSelect = pickDiv.querySelector('.trade-pick-round-select') as HTMLSelectElement;
        const designationSelect = pickDiv.querySelector('.trade-pick-designation-select') as HTMLSelectElement;
        if (roundSelect && designationSelect) {
            const updateVisibility = () => {
                // Fix for: Property 'value' does not exist on type 'Element'.
                const selectedRound = roundSelect.value;
                // Fix for: Property 'style' does not exist on type 'Element'.
                if (selectedRound === '1' || selectedRound === '2' || selectedRound === '3') designationSelect.style.display = 'block';
                // Fix for: Property 'style' does not exist on type 'Element'.
                // Fix for: Property 'value' does not exist on type 'Element'.
                else { designationSelect.style.display = 'none'; designationSelect.value = '';}
            };
            updateVisibility(); 
            roundSelect.addEventListener('change', updateVisibility);
        }
    });
}

function analyzeTrade() {
    if (!yourAssetsContainer || !theirAssetsContainer || !tradeResultDiv) return;
    let yourTotalValue = 0, theirTotalValue = 0;
    let yourAssetsDetail = [], theirAssetsDetail = [];
    yourAssetsContainer.querySelectorAll('.player-asset .trade-player-input').forEach(input => {
        const playerName = (input as HTMLInputElement).value.trim();
        if (playerName) { const value = getPlayerValueByName(playerName); yourTotalValue += value; yourAssetsDetail.push(`${playerName} (${value.toFixed(1)})`); }
    });
    yourAssetsContainer.querySelectorAll('.pick-asset').forEach(pickDiv => {
        const yearSelect = pickDiv.querySelector('.trade-pick-year-select') as HTMLSelectElement;
        const roundSelect = pickDiv.querySelector('.trade-pick-round-select') as HTMLSelectElement;
        const designationSelect = pickDiv.querySelector('.trade-pick-designation-select') as HTMLSelectElement;
        if (yearSelect && roundSelect && yearSelect.value && roundSelect.value) {
            let dVal = (designationSelect && (roundSelect.value === '1' || roundSelect.value === '2' || roundSelect.value === '3') && designationSelect.style.display !== 'none') ? designationSelect.value : '';
            const value = getDraftPickValue(yearSelect.value, roundSelect.value, dVal);
            yourTotalValue += value;
            let pDet = `Pick ${yearSelect.value}-${roundSelect.value}${dVal ? ` (${dVal})` : ''} (${value.toFixed(1)})`;
            yourAssetsDetail.push(pDet);
        }
    });
    theirAssetsContainer.querySelectorAll('.player-asset .trade-player-input').forEach(input => {
        const playerName = (input as HTMLInputElement).value.trim();
        if (playerName) { const value = getPlayerValueByName(playerName); theirTotalValue += value; theirAssetsDetail.push(`${playerName} (${value.toFixed(1)})`); }
    });
    theirAssetsContainer.querySelectorAll('.pick-asset').forEach(pickDiv => {
        const yearSelect = pickDiv.querySelector('.trade-pick-year-select') as HTMLSelectElement;
        const roundSelect = pickDiv.querySelector('.trade-pick-round-select') as HTMLSelectElement;
        const designationSelect = pickDiv.querySelector('.trade-pick-designation-select') as HTMLSelectElement;
        if (yearSelect && roundSelect && yearSelect.value && roundSelect.value) {
            let dVal = (designationSelect && (roundSelect.value === '1' || roundSelect.value === '2' || roundSelect.value === '3') && designationSelect.style.display !== 'none') ? designationSelect.value : '';
            const value = getDraftPickValue(yearSelect.value, roundSelect.value, dVal);
            theirTotalValue += value;
            let pDet = `Pick ${yearSelect.value}-${roundSelect.value}${dVal ? ` (${dVal})` : ''} (${value.toFixed(1)})`;
            theirAssetsDetail.push(pDet);
        }
    });
    let resultMessage = '', messageType = 'info';
    const difference = theirTotalValue - yourTotalValue;
    const yStr = `Your Side (${yourTotalValue.toFixed(1)}): ${yourAssetsDetail.join(', ') || 'N/A'}`;
    const tStr = `Their Side (${theirTotalValue.toFixed(1)}): ${theirAssetsDetail.join(', ') || 'N/A'}`;
    if (Math.abs(difference) < 5) { resultMessage = `Trade is Fair!\n${yStr}\n${tStr}`; messageType = 'success'; }
    else if (difference > 0) { resultMessage = `Trade favors YOUR side! Gain ${difference.toFixed(1)}.\n${yStr}\n${tStr}`; messageType = 'success'; }
    else { resultMessage = `Trade favors THEIR side! Lose ${Math.abs(difference).toFixed(1)}.\n${yStr}\n${tStr}`; messageType = 'error'; }
    tradeResultDiv.innerText = resultMessage;
    tradeResultDiv.className = `mt-6 p-4 rounded-md text-center whitespace-pre-line ${messageType === 'error' ? 'bg-red-700' : messageType === 'success' ? 'bg-green-700' : 'bg-blue-700'} text-white`;
    tradeResultDiv.style.display = 'block';
}

function getWeeklyRecommendations(allPlayers, count = 10) {
    const ratedPlayers = allPlayers.filter(p => p.weeklyMatchupRating !== undefined && p.weeklyMatchupRating !== null && p.weeklyMatchupRating !== '');
    const potentialStarts = [...ratedPlayers].sort((a, b) => parseFloat(b.weeklyMatchupRating) - parseFloat(a.weeklyMatchupRating) || (b.calculatedValue || 0) - (a.calculatedValue || 0));
    const potentialSits = [...ratedPlayers].sort((a, b) => parseFloat(a.weeklyMatchupRating) - parseFloat(b.weeklyMatchupRating) || (b.calculatedValue || 0) - (a.calculatedValue || 0));
    
    let starts = potentialStarts.filter(p => parseFloat(p.weeklyMatchupRating) >= 4).slice(0, count);
    if (starts.length < count) {
        starts = starts.concat(potentialStarts.filter(p => parseFloat(p.weeklyMatchupRating) === 3 && !starts.find(s=>s.id === p.id)).slice(0, count - starts.length));
    }
    let sits = potentialSits.filter(p => parseFloat(p.weeklyMatchupRating) <= 2).slice(0,count);
     if (sits.length < count) {
        sits = sits.concat(potentialSits.filter(p => parseFloat(p.weeklyMatchupRating) === 3 && !sits.find(s=>s.id === p.id)).slice(0, count - sits.length));
    }
     starts.sort((a, b) => parseFloat(b.weeklyMatchupRating) - parseFloat(a.weeklyMatchupRating) || (b.calculatedValue || 0) - (a.calculatedValue || 0)); // Final sort
     sits.sort((a, b) => parseFloat(a.weeklyMatchupRating) - parseFloat(b.weeklyMatchupRating) || (b.calculatedValue || 0) - (a.calculatedValue || 0)); // Final sort

    return { starts: starts.slice(0,count), sits: sits.slice(0,count) };
}

function displayWeeklyRecommendations(recommendations) {
    if (!topStartsList || !topSitsList) return;
    topStartsList.innerHTML = ''; topSitsList.innerHTML = '';
    if (recommendations.starts.length === 0 && recommendations.sits.length === 0) {
        topStartsList.innerHTML = '<li class="text-gray-400 p-2">No specific recommendations.</li>';
        topSitsList.innerHTML = '<li class="text-gray-400 p-2">No specific recommendations.</li>'; return;
    }
    recommendations.starts.forEach(p => { const li = document.createElement('li'); li.className = 'py-2 px-3 bg-gray-700 rounded-md mb-2 shadow'; li.innerHTML = `<div class="font-semibold text-white">${p.name} (${p.position} - ${p.team})</div><div class="text-sm text-green-400">Matchup Rating: ${p.weeklyMatchupRating}</div>${p.weeklyMatchupNotes ? `<div class="text-xs text-gray-300 italic mt-1">Note: ${p.weeklyMatchupNotes}</div>` : ''}`; topStartsList.appendChild(li); });
    if (recommendations.starts.length === 0) topStartsList.innerHTML = '<li class="text-gray-400 p-2">No strong starts this week.</li>';
    recommendations.sits.forEach(p => { const li = document.createElement('li'); li.className = 'py-2 px-3 bg-gray-700 rounded-md mb-2 shadow'; li.innerHTML = `<div class="font-semibold text-white">${p.name} (${p.position} - ${p.team})</div><div class="text-sm text-red-400">Matchup Rating: ${p.weeklyMatchupRating}</div>${p.weeklyMatchupNotes ? `<div class="text-xs text-gray-300 italic mt-1">Note: ${p.weeklyMatchupNotes}</div>` : ''}`; topSitsList.appendChild(li); });
    if (recommendations.sits.length === 0) topSitsList.innerHTML = '<li class="text-gray-400 p-2">No strong sits/fades this week.</li>';
}

async function loadPlayerDataFromCSV(csvPathOrData) {
    try {
        let csvText;
        // Check if csvPathOrData is the actual CSV data string (contains newlines and commas)
        if (typeof csvPathOrData === 'string' && csvPathOrData.includes('\n') && csvPathOrData.includes(',')) {
            csvText = csvPathOrData;
        } else if (typeof csvPathOrData === 'string') { // Else, assume it's a path and try to fetch
            const response = await fetch(csvPathOrData); 
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${csvPathOrData}`); 
            csvText = await response.text(); 
        }
        else throw new Error("Invalid CSV source.");
        
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line !== ''); // Split by newline
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            if (values.length === headers.length) {
                const playerObject = {};
                headers.forEach((header, index) => {
                    const value = values[index];
                    if (['age', 'nextYearPoints', 'receptions', 'snapShare', 'sosRank', 'offenseRank', 'weeklyMatchupRating'].includes(header)) {
                        playerObject[header] = parseFloat(value);
                        if (isNaN(playerObject[header])) playerObject[header] = (header === 'weeklyMatchupRating' ? 3 : 0); 
                    } else playerObject[header] = value;
                });
                data.push(playerObject);
            } else console.warn(`Skipping malformed CSV line ${i + 1}: ${lines[i]}`);
        }
        return data;
    } catch (error) { console.error("Error loading CSV:", error); showMessage(`Error loading player data: ${error.message}`, 'error', 7000); return []; }
}

document.addEventListener('DOMContentLoaded', async () => {
    applySettingsBtn = document.getElementById('applySettingsBtn') as HTMLButtonElement;
    leagueFormatSelect = document.getElementById('leagueFormat') as HTMLSelectElement;
    leagueTypeSelect = document.getElementById('leagueType') as HTMLSelectElement;
    pprScoringSelect = document.getElementById('pprScoring') as HTMLSelectElement;
    tePremiumSelect = document.getElementById('tePremium') as HTMLSelectElement;
    messageBox = document.getElementById('messageBox') as HTMLDivElement;
    playerRankingsTableBody = document.getElementById('player-rankings-table-body') as HTMLElement;
    analyzeTradeBtn = document.getElementById('analyzeTradeBtn') as HTMLButtonElement;
    tradeResultDiv = document.getElementById('tradeResult') as HTMLDivElement;
    yourAssetsContainer = document.getElementById('yourAssets') as HTMLDivElement;
    theirAssetsContainer = document.getElementById('theirAssets') as HTMLDivElement;
    topStartsList = document.getElementById('topStartsList') as HTMLUListElement;
    topSitsList = document.getElementById('topSitsList') as HTMLUListElement;

    const sampleCsvData = `id,name,position,team,age,nextYearPoints,receptions,snapShare,threeYearOutlook,contractStatus,draftCapital,sosRank,offenseRank,injuryHistory,weeklyMatchupRating,weeklyMatchupNotes
mahomes_p,Patrick Mahomes,QB,KC,29,350,1,0.95,elite,long-term,1st_round_top_10,11,2,low,5,vs LV pass D
mccaffrey_c,Christian McCaffrey,RB,SF,29,300,80,0.85,high,long-term,1st_round_top_10,32,1,moderate,4,Solid floor vs ARI
chase_j,Ja'Marr Chase,WR,CIN,25,320,100,0.90,elite,long-term,1st_round_top_10,14,8,low,2,Elite CB matchup (Lattimore)
kelce_t,Travis Kelce,TE,KC,35,180,90,0.80,low,expiring,3rd_round,11,2,low,3,Standard Kelce week
nabers_m,Malik Nabers,WR,NYG,22,200,70,0.75,elite,rookie,1st_round_top_5,1,28,low,5,Top target vs weak DAL secondary
stroud_c,CJ Stroud,QB,HOU,23,310,2,0.92,elite,rookie,1st_round_top_5,15,7,low,4,Jags D can be beat
bijan_r,Bijan Robinson,RB,ATL,22,250,50,0.70,high,rookie,1st_round_top_10,20,17,low,1,Stout CAR run D and low volume
jefferson_j,Justin Jefferson,WR,MIN,25,330,110,0.93,elite,long-term,1st_round,7,11,low,3,QB questions vs GB
allen_j,Josh Allen,QB,BUF,29,330,3,0.98,elite,long-term,1st_round,23,5,low,5,Always a start vs MIA
stbrown_a,Amon-Ra St. Brown,WR,DET,25,300,110,0.92,high,long-term,4th_round,3,4,low,4,Good spot vs CHI
laporta_s,Sam LaPorta,TE,DET,23,200,85,0.85,elite,rookie,2nd_round,3,4,low,2,CHI LBs are tough on TEs
hall_b,Breece Hall,RB,NYJ,23,240,60,0.65,high,long-term,2nd_round,26,25,moderate,4,NE matchup usually decent volume
puka_n,Puka Nacua,WR,LAR,24,280,105,0.90,elite,long-term,5th_round,17,10,low,5,SF secondary can be exploited`;
    
    //playersData = await loadPlayerDataFromCSV('players_data.csv'); // UNCOMMENT THIS TO USE EXTERNAL CSV
    playersData = await loadPlayerDataFromCSV(sampleCsvData); // COMMENT THIS OUT TO USE EXTERNAL CSV

    if (playersData.length > 0) {
        updateAllPlayerRankings(); // This now also calculates .calculatedValue for each player
        const weeklyRecs = getWeeklyRecommendations(playersData, 10);
        displayWeeklyRecommendations(weeklyRecs);
        showMessage('Player data loaded!', 'success', 4000);
    } else {
        showMessage('No player data. Check CSV or console.', 'error', 7000);
        if(playerRankingsTableBody) playerRankingsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No player data.</td></tr>';
        if(topStartsList) topStartsList.innerHTML = '<li class="text-gray-400 p-2">No player data for recommendations.</li>';
        if(topSitsList) topSitsList.innerHTML = '<li class="text-gray-400 p-2">No player data for recommendations.</li>';
    }
    
    setupInitialPickDesignationListeners();

    if (applySettingsBtn) {
        applySettingsBtn.addEventListener('click', () => {
            currentLeagueSettings.leagueFormat = leagueFormatSelect.value;
            currentLeagueSettings.leagueType = leagueTypeSelect.value;
            currentLeagueSettings.pprScoring = pprScoringSelect.value;
            currentLeagueSettings.tePremium = tePremiumSelect.value;
            updateAllPlayerRankings(); 
            const weeklyRecs = getWeeklyRecommendations(playersData, 10); 
            displayWeeklyRecommendations(weeklyRecs);
            showMessage('Settings Applied.', 'success');
        });
    }
    if (analyzeTradeBtn) {
        analyzeTradeBtn.addEventListener('click', analyzeTrade);
    }
    
    document.querySelectorAll('.add-asset-btn').forEach(button => {
        button.addEventListener('click', () => { 
            // Fix for: Property 'dataset' does not exist on type 'Element'.
            const side = (button as HTMLElement).dataset.side; 
            // Fix for: Property 'dataset' does not exist on type 'Element'.
            const type = (button as HTMLElement).dataset.type; 
            addAsset(side, type); 
        });
    });
});
