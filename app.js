// ==========================================
// การตั้งค่าหลัก (Configuration)
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwCALCCWgQL3se6SHHO-FO19qCe3Jc-wlAtqkXMtcmAkwblNLYg7M6ukQSvHsKpAb6FWQ/exec';

let currentUser = { username: '', role: '' };
let appData = { master: [], logs: [] };
let runChart = null;

// ==========================================
// 1. ระบบ Auth & Navigation
// ==========================================
document.getElementById("logPass").addEventListener("keypress", (e) => { if(e.key === "Enter") login(false); });

function switchAuthView(viewId) {
    ['loginView', 'registerView', 'forgotView'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    document.querySelectorAll('[id$="Msg"]').forEach(el => el.innerText = '');
}

async function login(isGuest) {
    const user = document.getElementById('logUser').value;
    const pass = document.getElementById('logPass').value;
    const btn = document.getElementById('btnLogin');
    
    if (!isGuest && (!user || !pass)) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    
    btn.innerText = "กำลังตรวจสอบ...";
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username: user, password: pass, isGuest: isGuest }) });
        const result = await res.json();

        if (result.status === 'success') {
            currentUser = { username: result.username, role: result.role };
            document.getElementById('authContainer').classList.add('hidden');
            document.getElementById('mainSection').classList.remove('hidden');
            document.getElementById('body-bg').classList.remove('bg-gradient-premium');
            document.getElementById('displayUser').innerText = currentUser.username;
            document.getElementById('displayRole').innerText = `Role: ${currentUser.role}`;
            
            document.querySelectorAll('.admin-only').forEach(el => currentUser.role === 'admin' ? el.classList.remove('hidden') : el.classList.add('hidden'));
            
            await fetchAppData();
        } else {
            document.getElementById('logMsg').innerText = result.message;
        }
    } catch(e) { document.getElementById('logMsg').innerText = "เชื่อมต่อ API ล้มเหลว"; }
    btn.innerText = "เข้าสู่ระบบ";
}

async function register() {
    const payload = {
        action: 'register',
        username: document.getElementById('regUser').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPass').value,
        role: document.getElementById('regRole').value,
        pdpa: document.getElementById('regPdpa').checked
    };
    if(payload.password !== document.getElementById('regPassConfirm').value) return alert("รหัสผ่านไม่ตรงกัน");
    document.getElementById('regMsg').innerText = "กำลังส่งข้อมูล...";
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    document.getElementById('regMsg').innerText = result.message;
}

function logout() {
    currentUser = { username: '', role: '' };
    document.getElementById('mainSection').classList.add('hidden');
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('body-bg').classList.add('bg-gradient-premium');
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('view-' + tabId).classList.remove('hidden');
    document.getElementById('btn-' + tabId).classList.add('active');
}

// ==========================================
// 2. Data Logic & Dashboard
// ==========================================
async function fetchAppData() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getInitialData' }) });
        const result = await res.json();
        if(result.status === 'success') {
            appData.master = result.master;
            appData.logs = result.logs;
            renderDashboard();
            renderInputTable();
            if(currentUser.role === 'admin') renderMasterTable();
        }
    } catch(e) { alert("เกิดข้อผิดพลาดในการโหลดข้อมูล"); }
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function renderDashboard() {
    // อัปเดต 4-Grid โดยประเมินจากข้อมูล Log ล่าสุดของแต่ละหมวด
    ['ENV', 'PHARM', 'FIN', 'SERV'].forEach(type => {
        updateGridStatus(type);
    });
    renderChart();
}

function updateGridStatus(type) {
    const gridEl = document.getElementById(`grid-${type}`);
    const txtEl = document.getElementById(`g-txt-${type}`);
    if(!gridEl) return;

    // หา Log ล่าสุดของ Type นี้
    const recentLogs = appData.logs.filter(l => l.type === type).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    gridEl.className = "p-5 rounded-xl text-center text-white transition-all shadow-md flex flex-col items-center justify-center";
    
    if(recentLogs.length === 0) {
        gridEl.className = "p-5 rounded-xl text-center bg-slate-100 text-slate-500 border";
        txtEl.innerText = "ยังไม่มีข้อมูล";
        return;
    }

    const master = appData.master.find(m => m.code === recentLogs[0].code);
    if(!master) return;

    // คำนวณความสำเร็จเทียบเป้าหมาย (Days left หรือ %)
    const currentPerformance = recentLogs[0].value / master.avgUse;
    const target = master.target;
    
    // เกณฑ์สี: >= Target (เขียว), >= Target*0.6 (เหลือง), < Target*0.6 (แดง)
    if (currentPerformance >= target) {
        gridEl.classList.add('bg-gradient-to-br', 'from-emerald-400', 'to-emerald-600');
        txtEl.innerText = "ระดับสีเขียว (ปกติ)";
    } else if (currentPerformance >= target * 0.6) {
        gridEl.classList.add('bg-gradient-to-br', 'from-yellow-400', 'to-yellow-500', 'text-slate-800');
        txtEl.innerText = "ระดับสีเหลือง (เฝ้าระวัง)";
        txtEl.className = "text-xs mt-1 bg-white/40 text-slate-800 font-bold px-2 py-1 rounded-full";
    } else {
        gridEl.classList.add('bg-gradient-to-br', 'from-red-600', 'to-red-800', 'animate-pulse');
        txtEl.innerText = "ระดับสีแดง (วิกฤต)";
    }
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (runChart) runChart.destroy();

    const filterType = document.getElementById('filterType').value;
    const daysLimit = parseInt(document.getElementById('filterTime').value);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    
    let filteredLogs = appData.logs.filter(l => new Date(l.date) >= cutoffDate);
    if (filterType !== 'ALL') filteredLogs = filteredLogs.filter(l => l.type === filterType);
    filteredLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

    // รวบรวมข้อมูลลง Dataset (แปลง Value เป็น Achievement ratio เทียบกับ Target)
    const labels = [...new Set(filteredLogs.map(l => new Date(l.date).toLocaleDateString('th-TH')))];
    
    // ดึงประเภททั้งหมดที่มีในข้อมูลที่กรองมา เพื่อสร้างเป็นหลายๆ เส้นกราฟ
    const typesPresent = [...new Set(filteredLogs.map(l => l.type))];
    const datasets = typesPresent.map(type => {
        const typeLogs = filteredLogs.filter(l => l.type === type);
        
        // กำหนดสีตาม Type
        const color = type === 'ENV' ? '#eab308' : type === 'PHARM' ? '#10b981' : type === 'FIN' ? '#f59e0b' : '#3b82f6';
        
        return {
            label: `ทรัพยากร ${type}`,
            data: labels.map(dateLabel => {
                const log = typeLogs.find(l => new Date(l.date).toLocaleDateString('th-TH') === dateLabel);
                if(!log) return null;
                const m = appData.master.find(x => x.code === log.code);
                return m ? (log.value / m.avgUse) : null;
            }),
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2,
            tension: 0.3,
            spanGaps: true
        };
    });

    runChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: `Run Chart (${daysLimit} วันย้อนหลัง)` } },
            scales: { y: { title: { display: true, text: 'ผลลัพธ์ (วัน/เปอร์เซ็นต์)' } } }
        }
    });
}

// ==========================================
// 3. Raw Data Input & Smart Grid
// ==========================================
function renderInputTable() {
    const tbody = document.getElementById('input-tbody');
    tbody.innerHTML = '';
    
    // กรอง Master Data ตามสิทธิ์
    let myMaster = appData.master;
    if(currentUser.role.startsWith('entry_')) {
        const roleType = currentUser.role.split('_')[1].toUpperCase();
        myMaster = myMaster.filter(m => m.type === roleType);
    }

    myMaster.forEach(m => {
        const typeColor = m.type === 'ENV' ? 'bg-yellow-100 text-yellow-700' : m.type === 'PHARM' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700';
        
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-3"><span class="${typeColor} px-2 py-1 rounded text-xs font-bold">${m.type}</span></td>
                <td class="p-3">${m.name} <br><span class="text-xs text-slate-400">Code: ${m.code}</span></td>
                <td class="p-3 bg-blue-50/30">
                    <input type="number" id="input_${m.code}" oninput="calcSmartGrid('${m.code}')" placeholder="กรอกตัวเลข" class="w-full border border-blue-200 p-2 rounded text-right font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                </td>
                <td class="p-3 text-center text-slate-500 hidden md:table-cell text-xs">
                    Target: <b>${m.target}</b><br>AvgUse: ${m.avgUse}
                </td>
                <td class="p-3 text-center font-bold text-lg" id="res_${m.code}">-</td>
                <td class="p-3 text-center" id="status_${m.code}">-</td>
            </tr>
        `;
    });
}

// ระบบคำนวณ Real-time ในหน้ากรอกข้อมูล
window.calcSmartGrid = function(code) {
    const m = appData.master.find(x => x.code === code);
    const val = parseFloat(document.getElementById(`input_${code}`).value);
    const resEl = document.getElementById(`res_${code}`);
    const statusEl = document.getElementById(`status_${code}`);

    if(isNaN(val) || !m) { resEl.innerText = "-"; statusEl.innerHTML = "-"; return; }

    const performance = val / m.avgUse;
    // ปรับ Format การแสดงผลตามประเภท (เช่น SERV โชว์เป็น %, อื่นๆ โชว์เป็นวัน)
    resEl.innerText = (m.type === 'SERV') ? `${performance.toFixed(1)} %` : `${Math.floor(performance)} วัน`;

    if (performance >= m.target) {
        resEl.className = "p-3 text-center font-bold text-lg text-emerald-600";
        statusEl.innerHTML = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">ปลอดภัย</span>`;
    } else if (performance >= m.target * 0.6) {
        resEl.className = "p-3 text-center font-bold text-lg text-yellow-600";
        statusEl.innerHTML = `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">เฝ้าระวัง</span>`;
    } else {
        resEl.className = "p-3 text-center font-bold text-lg text-red-600";
        statusEl.innerHTML = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse">วิกฤต</span>`;
    }
};

async function submitRawData() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    const dept = document.getElementById('inputDept').value;
    const payloads = [];

    appData.master.forEach(m => {
        const inputEl = document.getElementById(`input_${m.code}`);
        if (inputEl && inputEl.value !== "") {
            payloads.push({ type: m.type, code: m.code, value: parseFloat(inputEl.value) });
        }
    });

    if(payloads.length === 0) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        return alert("กรุณากรอกข้อมูลอย่างน้อย 1 รายการ");
    }

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitLog', username: currentUser.username, department: dept, payloads: payloads }) });
        alert("บันทึกข้อมูลเรียบร้อย");
        
        // เคลียร์ค่าที่กรอกแล้ว
        payloads.forEach(p => {
            document.getElementById(`input_${p.code}`).value = '';
            calcSmartGrid(p.code);
        });
        await fetchAppData(); 
    } catch(e) { alert("เชื่อมต่อล้มเหลว"); }
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// ==========================================
// 4. Master Data (Admin Only)
// ==========================================
function renderMasterTable() {
    const tbody = document.getElementById('master-tbody');
    tbody.innerHTML = '';
    appData.master.forEach((m, idx) => addMasterRow(idx, m));
}

function addMasterRow(id = new Date().getTime(), m = {type:'', code:'', name:'', avgUse:'', target:''}) {
    const tr = document.createElement('tr');
    tr.className = "border-b";
    tr.id = `mRow_${id}`;
    tr.innerHTML = `
        <td class="p-2"><input type="text" class="border p-1 w-full mType" value="${m.type}" placeholder="ENV/PHARM..."></td>
        <td class="p-2"><input type="text" class="border p-1 w-full mCode" value="${m.code}"></td>
        <td class="p-2"><input type="text" class="border p-1 w-full mName" value="${m.name}"></td>
        <td class="p-2"><input type="number" class="border p-1 w-full mAvg" value="${m.avgUse}"></td>
        <td class="p-2"><input type="number" class="border p-1 w-full mTarget" value="${m.target}"></td>
        <td class="p-2 text-center"><button onclick="document.getElementById('mRow_${id}').remove()" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td>
    `;
    document.getElementById('master-tbody').appendChild(tr);
}

async function saveMasterData() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    const newMaster = [];
    document.querySelectorAll('#master-tbody tr').forEach(tr => {
        newMaster.push({
            type: tr.querySelector('.mType').value.toUpperCase(),
            code: tr.querySelector('.mCode').value,
            name: tr.querySelector('.mName').value,
            avgUse: parseFloat(tr.querySelector('.mAvg').value) || 1,
            target: parseFloat(tr.querySelector('.mTarget').value) || 0
        });
    });

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateMaster', masterData: newMaster }) });
        const result = await res.json();
        alert(result.message);
        await fetchAppData();
    } catch(e) { alert("เชื่อมต่อล้มเหลว"); }
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// ==========================================
// 5. Export Data
// ==========================================
function exportExcel() {
    if(appData.logs.length === 0) return alert("ไม่มีข้อมูลประวัติให้ Export");
    // จัดรูปแบบข้อมูลก่อน Export
    const exportData = appData.logs.map(l => {
        const m = appData.master.find(x => x.code === l.code);
        return {
            "วันที่": new Date(l.date).toLocaleString('th-TH'),
            "ผู้บันทึก": l.user,
            "หมวดหมู่": l.type,
            "รหัส": l.code,
            "ชื่อรายการ": m ? m.name : '',
            "ยอดคงเหลือ (Raw)": l.value,
            "การประเมิน (วัน/%)": m ? (l.value / m.avgUse).toFixed(2) : ''
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RawData_Log");
    XLSX.writeFile(wb, "MOPH_Crisis_Export.xlsx");
}
