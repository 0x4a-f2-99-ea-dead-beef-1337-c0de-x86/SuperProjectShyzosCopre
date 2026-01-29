// =================================================================
// ☣️ GOD MODE v7.0 (Heartbeat & Auto-Sync Edition)
// =================================================================

(async () => {
    // --- SECURITE ANTI-DOUBLON ---
    if (window.GOD_MODE_ACTIVE) {
        console.log("⚠️ GOD MODE DÉJÀ ACTIF. Arrêt de l'ancienne instance...");
        const old = document.getElementById('god-panel');
        if(old) old.remove();
        // On ne peut pas facilement tuer les anciens listeners, donc on reload l'UI
    }
    window.GOD_MODE_ACTIVE = true;

    // --- NETTOYAGE UI ---
    ['god-panel', 'hack-toggle-icon', 'god-styles'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });

    // --- CHARGEMENT SOCKET ---
    let socketMod = (typeof gameSocketModule !== 'undefined') ? gameSocketModule : undefined;
    if (!socketMod) {
        try { socketMod = await import('/js/global-socket.js'); } 
        catch (e) { console.error("❌ Erreur socket (Chemin local non trouvé)"); return; }
    }
    const socket = await socketMod.initializeSocket();

    // --- CONFIGURATION ---
    const STATE = {
        running: false,
        queue: [],
        processing: false,
        targets: new Map(),
        myViruses: {},
        loops: [], // Stocke les ID des intervals pour les tuer proprement
        config: {
            delay: 1200, // Vitesse d'attaque
            refreshRate: 4000, // Vitesse du Heartbeat (4s)
            autoRecruit: { enabled: false, smartMode: true, manualFW: 1, manualAV: 1 },
            attacks: { scan: true, trojan: true, crypto: false, botnet: false, fraud: false },
            autoKick: true
        }
    };

    // MAPPING DEFENSE
    const MAP = { 'access-trojan': 'firewall', 'crypto-stealer': 'wallet_encryption', 'bankfraud': 'wallet_encryption', 'botnet': 'operational_security', 'target-scanner': 'operational_security' };

    // --- STYLES ---
    const style = document.createElement('style');
    style.id = 'god-styles';
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        :root { --main: #0f0; --bg: rgba(0, 5, 0, 0.95); --err: #f44; }
        #god-panel { font-family: 'Share Tech Mono', monospace; font-size: 11px; background: var(--bg); border: 1px solid var(--main); color: var(--main); width: 450px; position: fixed; top: 50px; left: 50px; z-index: 999999; display: flex; flex-direction: column; box-shadow: 0 0 20px rgba(0,255,0,0.1); }
        #god-header { background: rgba(0,255,0,0.1); padding: 8px; cursor: grab; display: flex; justify-content: space-between; border-bottom: 1px solid var(--main); }
        .god-tabs { display: flex; background: #001100; border-bottom: 1px solid #004400; }
        .god-tab { flex: 1; text-align: center; padding: 8px; cursor: pointer; color: #484; transition: 0.2s; }
        .god-tab.active { color: var(--main); background: #002200; border-bottom: 2px solid var(--main); }
        .god-content { padding: 15px; height: 350px; overflow-y: auto; display: none; }
        .god-content.active { display: block; }
        .god-section { background: rgba(0,20,0,0.5); border: 1px solid #004400; padding: 8px; margin-bottom: 8px; }
        .god-btn { width: 100%; padding: 10px; background: #002200; border: 1px solid var(--main); color: var(--main); cursor: pointer; margin-top: 5px; font-family: inherit; }
        .god-btn:hover { background: #003300; box-shadow: 0 0 10px var(--main); }
        .god-btn.stop { border-color: var(--err); color: var(--err); }
        .god-log { height: 100%; overflow-y: auto; font-size: 10px; border-top: 1px solid #004400; }
        .log-entry { padding: 2px 0; border-bottom: 1px solid #002200; }
        .god-chk { cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .pulsing { animation: pulse 1s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    `;
    document.head.appendChild(style);

    // --- UI ---
    const div = document.createElement('div');
    div.id = 'god-panel';
    div.innerHTML = `
        <div id="god-header"><b>⚡ GOD-MODE v7</b> <span id="god-close" style="cursor:pointer">[X]</span></div>
        <div class="god-tabs">
            <div class="god-tab active" data-tab="home">DASH</div>
            <div class="god-tab" data-tab="virus">VIRUS</div>
            <div class="god-tab" data-tab="rec">RECRUIT</div>
            <div class="god-tab" data-tab="log">LOGS</div>
        </div>
        
        <div id="tab-home" class="god-content active">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div class="god-section" style="flex:1; text-align:center; margin-right:5px;">
                    BOTNET: <span id="conn-disp" style="font-size:16px; color:#fff">0</span>/25
                </div>
                <div class="god-section" style="flex:1; text-align:center; margin-left:5px;">
                    QUEUE: <span id="queue-disp" style="font-size:16px; color:var(--main)">0</span>
                </div>
            </div>
            <button id="btn-init" class="god-btn">INITIALIZE SYSTEM</button>
            <div id="heartbeat-indicator" style="text-align:center; font-size:9px; color:#555; margin-top:5px;">HEARTBEAT: OFFLINE</div>
            
            <div class="god-section" style="margin-top:15px;">
                <div style="font-size:10px; color:#aaa; border-bottom:1px solid #004400; margin-bottom:5px;">AUTO-ATTACK</div>
                <label class="god-chk"><input type="checkbox" id="chk-scan" checked> SCANNER</label>
                <label class="god-chk"><input type="checkbox" id="chk-trojan" checked> TROJAN</label>
                <label class="god-chk"><input type="checkbox" id="chk-crypto"> CRYPTO</label>
                <label class="god-chk"><input type="checkbox" id="chk-botnet"> BOTNET</label>
                <label class="god-chk"><input type="checkbox" id="chk-fraud"> FRAUD</label>
            </div>
             <div class="god-section" style="border-color:var(--err)">
                <label class="god-chk" style="color:#f88"><input type="checkbox" id="chk-kick" checked> AUTO-PRUNE (EJECT WEAK)</label>
            </div>
        </div>

        <div id="tab-virus" class="god-content"><div id="virus-list-container" style="padding:10px;">WAITING SYNC...</div></div>

        <div id="tab-rec" class="god-content">
            <div class="god-section">
                <label class="god-chk"><input type="checkbox" id="chk-auto-rec"> <b>AUTO-RECRUIT</b></label>
                <div class="god-section" style="margin-top:10px; background:#001100;">
                    <label class="god-chk"><input type="checkbox" id="chk-smart" checked> <b style="color:#0ff">SMART TARGETING (AI)</b></label>
                </div>
                <div id="manual-controls" style="opacity:0.5;">
                    Manual FW Limit: <input type="number" id="inp-maxfw" value="1" style="width:40px; background:#000; border:1px solid #004400; color:#fff">
                </div>
            </div>
            <div id="rec-status" style="font-size:10px; color:#0ff; text-align:center; margin-top:5px;"></div>
        </div>

        <div id="tab-log" class="god-content">
            <div id="log-box" class="god-log" style="height:300px;"></div>
        </div>
    `;
    document.body.appendChild(div);

    // --- LOGIC ---
    function log(msg, type="info") {
        const el = document.getElementById('log-box');
        if(!el) return;
        const col = type==="error"?"#f55":type==="success"?"#5f5":type==="warn"?"#fa0":"#8a8";
        el.innerHTML += `<div class="log-entry"><span style="color:#555">[${new Date().toLocaleTimeString().split(' ')[0]}]</span> <span style="color:${col}">${msg}</span></div>`;
        el.scrollTop = el.scrollHeight;
    }

    // --- HEARTBEAT SYSTEM (Le Correctif Majeur) ---
    function startHeartbeat() {
        // Nettoyage ancien
        STATE.loops.forEach(clearInterval);
        STATE.loops = [];

        log("💓 HEARTBEAT STARTED (4s)", "success");
        document.getElementById('heartbeat-indicator').innerHTML = "<span class='pulsing' style='color:#0f0'>●</span> HEARTBEAT: ONLINE";

        // Refresh Loop
        const loop = setInterval(() => {
            if(!STATE.running) return;
            
            // On demande les updates silencieusement
            socketMod.emit('connections-count');
            socketMod.emit('get-outgoing-connections');
            
            // Si recrutement actif, on scanne
            if(STATE.config.autoRecruit.enabled) {
                // Seulement si on a de la place
                const active = parseInt(document.getElementById('conn-disp').innerText || "0");
                if(active < 25) {
                    socketMod.emit('fetch-network-targets');
                }
            }
        }, STATE.config.refreshRate);

        STATE.loops.push(loop);
    }

    // --- QUEUE & ATTACK LOGIC ---
    function addToQueue(type, subtype, data, desc) {
        if (!STATE.running) return;
        if (STATE.queue.some(q => q.data.targetId == data.targetId && q.subtype == subtype)) return;
        STATE.queue.push({ type, subtype, data, desc });
        document.getElementById('queue-disp').innerText = STATE.queue.length;
        processQueue();
    }

    async function processQueue() {
        if (STATE.processing || STATE.queue.length === 0 || !STATE.running) return;
        STATE.processing = true;
        const task = STATE.queue.shift();
        document.getElementById('queue-disp').innerText = STATE.queue.length;

        // Toggles check
        if (task.type === 'attack' && !STATE.config.attacks[task.subtype]) { STATE.processing = false; processQueue(); return; }

        // SUPERIORITY CHECK (AI)
        if (task.type === 'attack' && task.subtype !== 'scan') {
            const t = STATE.targets.get(parseInt(task.data.targetId));
            const v = STATE.myViruses[task.subtype === 'infect'?'access-trojan':task.subtype==='crypto'?'crypto-stealer':task.subtype==='botnet'?'botnet':'bankfraud'];
            
            if (t && v) {
                const defName = MAP[v.type];
                const defVal = t[defName];
                // 1. Efficiency check
                if (defVal !== undefined && v.efficiency <= defVal) {
                    log(`🛡️ WEAK: ${v.name} (Lvl${v.efficiency}) <= ${defName} (Lvl${defVal})`, "warn");
                    if(STATE.config.autoKick) socketMod.emit('close-connection', String(task.data.targetId));
                    STATE.processing = false; processQueue(); return;
                }
                // 2. Stealth check (Obf > AV)
                if (t.antivirus !== undefined && v.obfuscation < t.antivirus) {
                    log(`👁️ DETECT RISK: ${t.target_username} (AV${t.antivirus} > Obf${v.obfuscation})`, "error");
                    if(STATE.config.autoKick) socketMod.emit('close-connection', String(task.data.targetId));
                    STATE.processing = false; processQueue(); return;
                }
            }
        }

        log(`➤ ${task.desc}`);
        socketMod.emit(task.data.action || 'execute-virus', task.data);
        await new Promise(r => setTimeout(r, STATE.config.delay));
        STATE.processing = false;
        processQueue();
    }

    // --- SOCKET EVENTS ---
    socket.on('viruses-list', (list) => {
        const best = {};
        let html = '';
        list.forEach(v => { if (!best[v.type] || best[v.type].efficiency < v.efficiency) best[v.type] = v; });
        STATE.myViruses = best;
        Object.values(best).forEach(v => {
            html += `<div style="background:#001100; padding:5px; margin-bottom:2px; border-left:2px solid #0f0; display:flex; justify-content:space-between;"><span>${v.name}</span> <span style="color:#aaa; font-size:9px">E:${v.efficiency} O:${v.obfuscation}</span></div>`;
        });
        document.getElementById('virus-list-container').innerHTML = html || "No Virus Found";
        
        // Update Smart Recruit UI
        const trojan = best['access-trojan'];
        if(STATE.config.autoRecruit.smartMode && trojan) {
            document.getElementById('rec-status').innerText = `AI TARGETING: FIREWALL ≤ ${Math.max(1, trojan.efficiency - 1)}`;
        }
    });

    socket.on('outgoing-connections-list', (list) => {
        document.getElementById('conn-disp').innerText = list.length;
        list.forEach(t => STATE.targets.set(t.target_id, t));
        if(!STATE.running) return;

        list.forEach(t => {
            const tId = String(t.target_id);
            // Auto-Prune immediate
            if(STATE.config.autoKick && t.is_scanned && STATE.myViruses['access-trojan']) {
                if(t.firewall >= STATE.myViruses['access-trojan'].efficiency) {
                    socketMod.emit('close-connection', tId);
                    return;
                }
            }

            // Attack planner
            if (t.access === 0) {
                if(STATE.config.attacks.scan) queueAttack('target-scanner', 'scan', tId, t.target_ip, t.target_username);
                if(STATE.config.attacks.trojan) queueAttack('access-trojan', 'infect', tId, t.target_ip, t.target_username);
            } else {
                ['crypto', 'fraud', 'botnet'].forEach(type => {
                    const vType = type==='crypto'?'crypto-stealer':type==='fraud'?'bankfraud':'botnet';
                    if(STATE.config.attacks[type]) queueAttack(vType, type, tId, t.target_ip, t.target_username);
                });
            }
        });
    });

    socket.on('network-targets', (list) => {
        if (!STATE.running || !STATE.config.autoRecruit.enabled) return;
        if (parseInt(document.getElementById('conn-disp').innerText) >= 25) return;

        let maxFW = STATE.config.autoRecruit.manualFW;
        if (STATE.config.autoRecruit.smartMode && STATE.myViruses['access-trojan']) {
            maxFW = Math.max(1, STATE.myViruses['access-trojan'].efficiency - 1);
        }

        list.filter(t => t.firewall <= maxFW && t.antivirus <= 1 && t.id !== 315).forEach(t => {
            if(!STATE.targets.has(t.id)) addToQueue('recruit', 'conn', { action: 'add-connection', targetId: t.id, targetIp: t.ip, targetUsername: t.username }, `➕ LINK: ${t.username}`);
        });
    });

    function queueAttack(vType, sub, id, ip, name) {
        const v = STATE.myViruses[vType];
        if (v) addToQueue('attack', sub, { virusId: v.id, targetId: id, targetIp: ip, virusName: v.name }, `⚔️ ${v.name} > ${name}`);
    }

    // --- CONTROLS ---
    // Start/Stop
    document.getElementById('btn-init').onclick = (e) => {
        STATE.running = !STATE.running;
        const btn = e.target;
        if(STATE.running) {
            btn.innerText = "🛑 TERMINATE SYSTEM";
            btn.classList.add('stop');
            log("SYSTEM ONLINE.", "success");
            
            // 1. Initial Sync
            socketMod.emit('get-viruses');
            socketMod.emit('connections-count');
            socketMod.emit('get-outgoing-connections');
            
            // 2. Start Heartbeat Loop
            startHeartbeat();
        } else {
            btn.innerText = "▶ INITIALIZE SYSTEM";
            btn.classList.remove('stop');
            STATE.loops.forEach(clearInterval);
            document.getElementById('heartbeat-indicator').innerHTML = "HEARTBEAT: OFFLINE";
            log("SYSTEM PAUSED.", "warn");
        }
    };

    // UI Bindings
    const bindC = (id, obj, key) => document.getElementById(id).onchange = e => { if(key) STATE.config[obj][key]=e.target.checked; else STATE.config[obj]=e.target.checked; };
    const bindI = (id, obj, key) => document.getElementById(id).onchange = e => { STATE.config[obj][key]=parseInt(e.target.value); };

    bindC('chk-scan', 'attacks', 'scan'); bindC('chk-trojan', 'attacks', 'trojan');
    bindC('chk-crypto', 'attacks', 'crypto'); bindC('chk-botnet', 'attacks', 'botnet');
    bindC('chk-fraud', 'attacks', 'fraud'); bindC('chk-kick', 'autoKick');
    bindC('chk-auto-rec', 'autoRecruit', 'enabled'); bindC('chk-smart', 'autoRecruit', 'smartMode');
    bindI('inp-maxfw', 'autoRecruit', 'manualFW');

    // Drag & Tabs
    const head = document.getElementById('god-header');
    let isD=false,sx,sy,ix,iy;
    head.onmousedown=e=>{isD=true;sx=e.clientX;sy=e.clientY;ix=div.offsetLeft;iy=div.offsetTop;head.style.cursor='grabbing'};
    document.onmousemove=e=>{if(isD){div.style.left=(ix+e.clientX-sx)+'px';div.style.top=(iy+e.clientY-sy)+'px'}};
    document.onmouseup=()=>isD=false;
    document.querySelectorAll('.god-tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.god-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.god-content').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.getElementById('tab-'+t.dataset.tab).classList.add('active');});
    document.getElementById('god-close').onclick=()=>div.style.display='none';

    // Inject Icon
    if(!document.getElementById('hack-toggle-icon')) {
        const i = document.createElement('div'); i.id='hack-toggle-icon'; i.className='icon-container';
        i.innerHTML='⚡'; i.style='cursor:pointer;margin-left:10px;color:#0f0;font-size:16px;font-weight:bold';
        i.onclick=()=>div.style.display=div.style.display==='none'?'flex':'none';
        document.querySelector('.left-section')?.appendChild(i);
    }
    log("GOD MODE v7 READY.", "success");
})();