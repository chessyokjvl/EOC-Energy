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
    
    if (!isGuest && (!user || !pass)) return alert("กรุณากรอกข้อมูล");
    
    btn.innerText = "กำลังตรวจสอบ...";
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username: user, password: pass, isGuest: isGuest }) });
        const result = await res.json();

        if (result.status === 'success') {
            currentUser = { username: result.username, role: result.role };
            
            // Set UI
            document.getElementById('authContainer').classList.add('hidden');
            document.getElementById('mainSection').classList.remove('hidden');
            document.getElementById('body-bg').classList.remove('bg-gradient-premium');
            document.getElementById('displayUser').innerText = currentUser.username;
            document.getElementById('displayRole').innerText = `Role: ${currentUser.role}`;
            
            // Handle Role Access
            if (currentUser.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
            }

            // Load Data
            await fetchAppData();
        } else {
            document.getElementById('logMsg').innerText = result.message;
        }
    } catch(e) { document.getElementById('logMsg').innerText = "เชื่อมต่อล้มเหลว"; }
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
    if(payload.password !== document.getElementById('regPassConfirm').value) return alert("รหัสไม่ตรงกัน");
    
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
// 2. Data Loading & Dashboard Logic
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
    } catch(e) { alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function renderDashboard() {
    // 1. Update 4-Grid Status (คำนวณจาก Log ล่าสุด)
    updateGridColor('grid-1', 'g1-txt', 'ENV');
    updateGridColor('grid-2', 'g2-txt', 'PHARM');
    
    // 2. Render Chart
    renderChart();
}

function updateGridColor(gridId, txtId, type) {
    const el = document.getElementById(gridId);
    const txt = document.getElementById(txtId);
    
    // หาข้อมูลล่าสุดของ Type นี้
    const recentLogs = appData.logs.filter(l => l.type === type).sort((a,b) => new Date(b.date) - new Date(a.date));
    if(recentLogs.length === 0) return;
    
    const masterInfo = appData.master.find(m => m.code === recentLogs[0].code);
    if(!masterInfo) return;
    
    const daysLeft = Math.floor(recentLogs[0].value / masterInfo.avgUse);
    const target = masterInfo.target;

    el.className = "p-4 rounded-xl text-center text-white transition-all shadow-md";
    if (daysLeft >= target) { el.classList.add('bg-gradient-to-br', 'from-emerald-400', 'to-emerald-600'); txt.innerText = "ปกติ"; }
    else if (daysLeft >= target * 0.5) { el.classList.add('bg-gradient-to-br', 'from-yellow-400', 'to-yellow-600'); txt.innerText = "เฝ้าระวัง"; }
    else { el.classList.add('bg-gradient-to-br', 'from-red-500', 'to-red-700', 'animate-pulse'); txt.innerText = "วิกฤต"; }
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (runChart) runChart.destroy(); // ลบกราฟเก่าทิ้งก่อนวาดใหม่

    const filterType = document.getElementById('filterType').value;
    const daysLimit = parseInt(document.getElementById('filterTime').value);
    
    // กรองข้อมูลตามเวลาและประเภท
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    
    let filteredLogs = appData.logs.filter(l => new Date(l.date) >= cutoffDate);
    if (filterType !== 'ALL') filteredLogs = filteredLogs.filter(l => l.type === filterType);
    
    // เรียงตามเวลา
    filteredLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

    const labels = filteredLogs.map(l => new Date(l.date).toLocaleDateString('th-TH'));
    const dataPoints = filteredLogs.map(l => {
        const m = appData.master.find(x => x.code === l.code);
        return m ? Math.floor(l.value / m.avgUse) : 0; // แปลง Raw value เป็น Days of Stock
    });

    runChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ปริมาณสำรองที่ใช้ได้ (วัน)',
                data: dataPoints,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: `Run Chart: ทรัพยากร ${filterType} (${daysLimit} วันย้อนหลัง)` } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Days of Stock' } } }
        }
    });
}

// ==========================================
// 3. Raw Data Input
// ==========================================
function renderInputTable() {
    const tbody = document.getElementById('input-tbody');
    tbody.innerHTML = '';
    
    // กรองให้เห็นเฉพาะของแผนกตัวเอง (ตัวอย่าง: ถ้าไม่ใช่ Admin ก็เห็นเฉพาะ ENV หรือ PHARM ตาม Role)
    let myMaster = appData.master;
    if(currentUser.role === 'entry_env') myMaster = myMaster.filter(m => m.type === 'ENV');
    if(currentUser.role === 'entry_pharm') myMaster = myMaster.filter(m => m.type === 'PHARM');

    myMaster.forEach(m => {
        tbody.innerHTML += `
            <tr class="border-b">
                <td class="p-3"><span class="bg-slate-200 px-2 py-1 rounded text-xs">${m.type}</span></td>
                <td class="p-3">${m.name} <br><span class="text-xs text-slate-400">${m.code}</span></td>
                <td class="p-3 bg-blue-50/50"><input type="number" id="input_${m.type}_${m.code}" class="w-full border p-2 rounded text-right font-bold text-blue-700"></td>
            </tr>
        `;
    });
}

async function submitRawData() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    const dept = document.getElementById('inputDept').value;
    
    // วนลูปส่งข้อมูลที่มีการกรอก
    for (const m of appData.master) {
        const inputEl = document.getElementById(`input_${m.type}_${m.code}`);
        if (inputEl && inputEl.value !== "") {
            const payload = {
                action: 'submitLog',
                username: currentUser.username,
                department: dept,
                type: m.type,
                code: m.code,
                value: parseFloat(inputEl.value)
            };
            await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            inputEl.value = ""; // เคลียร์ช่อง
        }
    }
    
    alert("บันทึกข้อมูลเรียบร้อย");
    await fetchAppData(); // โหลดข้อมูลใหม่เพื่อให้กราฟและกริดเปลี่ยน
}

// ==========================================
// 4. Master Data (Admin)
// ==========================================
function renderMasterTable() {
    const tbody = document.getElementById('master-tbody');
    tbody.innerHTML = '';
    appData.master.forEach((m, idx) => {
        tbody.innerHTML += `
            <tr class="border-b" id="mRow_${idx}">
                <td class="p-2"><input type="text" class="border p-1 w-full mType" value="${m.type}"></td>
                <td class="p-2"><input type="text" class="border p-1 w-full mCode" value="${m.code}"></td>
                <td class="p-2"><input type="text" class="border p-1 w-full mName" value="${m.name}"></td>
                <td class="p-2"><input type="number" class="border p-1 w-full mAvg" value="${m.avgUse}"></td>
                <td class="p-2"><input type="number" class="border p-1 w-full mTarget" value="${m.target}"></td>
                <td class="p-2 text-center"><button onclick="document.getElementById('mRow_${idx}').remove()" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });
}

function addMasterRow() {
    const idx = new Date().getTime();
    document.getElementById('master-tbody').innerHTML += `
        <tr class="border-b" id="mRow_${idx}">
            <td class="p-2"><input type="text" class="border p-1 w-full mType" placeholder="เช่น ENV"></td>
            <td class="p-2"><input type="text" class="border p-1 w-full mCode" placeholder="Code"></td>
            <td class="p-2"><input type="text" class="border p-1 w-full mName" placeholder="Name"></td>
            <td class="p-2"><input type="number" class="border p-1 w-full mAvg" placeholder="Avg"></td>
            <td class="p-2"><input type="number" class="border p-1 w-full mTarget" placeholder="Target"></td>
            <td class="p-2 text-center"><button onclick="document.getElementById('mRow_${idx}').remove()" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `;
}

async function saveMasterData() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    const newMaster = [];
    document.querySelectorAll('#master-tbody tr').forEach(tr => {
        newMaster.push({
            type: tr.querySelector('.mType').value,
            code: tr.querySelector('.mCode').value,
            name: tr.querySelector('.mName').value,
            avgUse: parseFloat(tr.querySelector('.mAvg').value) || 0,
            target: parseFloat(tr.querySelector('.mTarget').value) || 0
        });
    });

    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateMaster', masterData: newMaster }) });
    const result = await res.json();
    alert(result.message);
    await fetchAppData();
}

// ==========================================
// 5. Export Data
// ==========================================
function exportExcel() {
    // สร้าง Workbook จาก Log Data ล่าสุด
    if(!appData.logs || appData.logs.length === 0) return alert("ไม่มีข้อมูลสำหรับ Export");
    const ws = XLSX.utils.json_to_sheet(appData.logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RawData_Log");
    XLSX.writeFile(wb, "Crisis_Command_Export.xlsx");
}
// (สำหรับการ Export PDF ใช้การเรียก window.print() ซึ่งถูกตั้งค่า CSS @media print ซ่อนเมนูไว้ให้แล้วในไฟล์ html ครับ)
