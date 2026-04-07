// ==========================================
// การตั้งค่าหลัก (Configuration)
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwCALCCWgQL3se6SHHO-FO19qCe3Jc-wlAtqkXMtcmAkwblNLYg7M6ukQSvHsKpAb6FWQ/exec'; // ** นำ URL ของ GAS มาใส่ตรงนี้ **
let currentUser = '';

// ==========================================
// ระบบ Authentication (เข้าสู่ระบบ / สมัคร / ลืมรหัส)
// ==========================================

// ดักจับการกด Enter ในช่องรหัสผ่าน
document.getElementById("logPass").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        login();
    }
});

function switchAuthView(viewId) {
    ['loginView', 'registerView', 'forgotView'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
    
    // ล้างข้อความแจ้งเตือน
    document.getElementById('logMsg').innerText = '';
    document.getElementById('regMsg').innerText = '';
    document.getElementById('forgotMsg').innerText = '';
}

async function login() {
    const user = document.getElementById('logUser').value;
    const pass = document.getElementById('logPass').value;
    const msgLabel = document.getElementById('logMsg');
    
    if(!user || !pass) { msgLabel.innerText = "กรุณากรอกข้อมูลให้ครบถ้วน"; return; }
    
    msgLabel.innerText = "กำลังตรวจสอบ...";
    msgLabel.className = "text-blue-500 text-center mt-3 text-sm h-5";

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username: user, password: pass }) });
        const result = await res.json();

        if (result.status === 'success') {
            currentUser = result.username;
            document.getElementById('authContainer').classList.add('hidden');
            document.getElementById('mainSection').classList.remove('hidden');
            document.getElementById('displayUser').innerText = `${result.username}`;
            document.getElementById('body-bg').classList.remove('bg-gradient-premium');
        } else {
            msgLabel.innerText = result.message;
            msgLabel.className = "text-red-500 text-center mt-3 text-sm h-5";
        }
    } catch(e) {
        msgLabel.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
        msgLabel.className = "text-red-500 text-center mt-3 text-sm h-5";
    }
}

async function register() {
    // โค้ดสมัครสมาชิก (ส่งข้อมูลไป GAS)
    const user = document.getElementById('regUser').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const passConfirm = document.getElementById('regPassConfirm').value;
    const role = document.getElementById('regRole').value;
    const pdpa = document.getElementById('regPdpa').checked;
    const msgLabel = document.getElementById('regMsg');

    if(!user || !email || !pass || !role) { msgLabel.innerText = "กรุณากรอกให้ครบถ้วน"; return; }
    if(pass !== passConfirm) { msgLabel.innerText = "รหัสผ่านไม่ตรงกัน"; return; }
    if(!pdpa) { msgLabel.innerText = "กรุณายอมรับนโยบาย PDPA"; return; }

    msgLabel.innerText = "กำลังส่งข้อมูล...";
    msgLabel.className = "text-blue-500 text-center mt-3 text-sm h-5";

    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'register', username: user, email: email, password: pass, role: role, pdpa: pdpa }) 
        });
        const result = await res.json();
        
        if(result.status === 'success') {
            msgLabel.className = "text-green-600 text-center mt-3 text-sm h-5";
            msgLabel.innerText = result.message;
            setTimeout(() => switchAuthView('loginView'), 2000);
        } else {
            msgLabel.innerText = result.message;
            msgLabel.className = "text-red-500 text-center mt-3 text-sm h-5";
        }
    } catch(e) { msgLabel.innerText = "เชื่อมต่อล้มเหลว"; }
}

async function requestReset() {
    // โค้ดขอรีเซ็ตรหัสผ่าน (ส่งอีเมลไป GAS)
    const email = document.getElementById('forgotEmail').value;
    const msgLabel = document.getElementById('forgotMsg');
    if(!email) return;
    
    msgLabel.innerText = "กำลังดำเนินการ...";
    msgLabel.className = "text-blue-500 text-center mt-3 text-sm h-5";
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'forgotPassword', email: email }) });
        const result = await res.json();
        msgLabel.innerText = result.message;
        msgLabel.className = result.status === 'success' ? "text-green-600 text-center mt-3 text-sm h-5" : "text-red-500 text-center mt-3 text-sm h-5";
    } catch(e) { msgLabel.innerText = "เชื่อมต่อล้มเหลว"; }
}

function logout() {
    currentUser = '';
    document.getElementById('logUser').value = '';
    document.getElementById('logPass').value = '';
    document.getElementById('mainSection').classList.add('hidden');
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('body-bg').classList.add('bg-gradient-premium');
    switchAuthView('loginView');
}

// ==========================================
// ระบบ UI และการนำทาง (Navigation)
// ==========================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active', 'text-slate-300'));
    
    document.getElementById('view-' + tabId).classList.remove('hidden');
    const activeBtn = document.getElementById('btn-' + tabId);
    activeBtn.classList.add('active');
    if(tabId === 'settings') activeBtn.classList.remove('text-slate-300');

    const titles = {
        'dashboard': 'วิเคราะห์สถานการณ์รวม (Strategic Dashboard)',
        'form-env': 'บันทึกข้อมูลดิบ: ทรัพยากรพลังงาน',
        'form-pharm': 'บันทึกข้อมูลดิบ: ยาและเวชภัณฑ์ (Raw Data)',
        'settings': 'ตั้งค่าระบบและข้อมูลมาตรฐาน (Master Data)'
    };
    document.getElementById('pageTitle').innerText = titles[tabId];
    
    if (window.innerWidth < 768) toggleSidebar();
}

// ==========================================
// ระบบสมองกล (Smart Grid Calculation)
// ==========================================
function calcDays(itemKey) {
    // ดึงค่า Master Data
    const burnRate = parseFloat(document.getElementById('md_' + itemKey + '_rate').value) || parseFloat(document.getElementById('ref_' + itemKey).innerText);
    document.getElementById('ref_' + itemKey).innerText = burnRate;

    // ดึง Raw Data (สิ่งที่ User พิมพ์)
    const currentStock = parseFloat(document.getElementById('raw_' + itemKey).value);
    const daysCell = document.getElementById('days_' + itemKey);
    const statusCell = document.getElementById('status_' + itemKey);

    if (isNaN(currentStock) || currentStock === "") {
        daysCell.innerText = "-";
        statusCell.innerHTML = "-";
        return;
    }

    // คำนวณ Days of Stock
    const daysLeft = Math.floor(currentStock / burnRate);
    daysCell.innerText = daysLeft;

    // ประเมินสถานะเป้าหมาย (สมมติเป้ากรมฯ คือ 90 วัน สำหรับยา และ 14 วัน สำหรับน้ำมัน)
    const targetDays = itemKey === 'diesel' ? 14 : 90;
    
    if (daysLeft >= targetDays) {
        daysCell.className = "p-3 text-center font-bold text-lg text-emerald-600";
        statusCell.innerHTML = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">👍 ปลอดภัย</span>`;
    } else if (daysLeft >= targetDays * 0.5) {
        daysCell.className = "p-3 text-center font-bold text-lg text-yellow-600";
        statusCell.innerHTML = `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">⚠️ เฝ้าระวัง</span>`;
    } else {
        daysCell.className = "p-3 text-center font-bold text-lg text-red-600";
        statusCell.innerHTML = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">🚨 วิกฤต</span>`;
    }
}

// ==========================================
// ระบบส่งข้อมูล (Submit to GAS)
// ==========================================
async function submitData(actionType) {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    
    let payload = { action: actionType, username: currentUser, data: {} };

    // เก็บข้อมูล Raw Data เพื่อส่งไปบันทึก
    if(actionType === 'submitPharm') {
        payload.data.halo_raw = document.getElementById('raw_halo').value;
        payload.data.diaz_raw = document.getElementById('raw_diaz').value;
    } else if(actionType === 'submitEnv') {
        payload.data.diesel_raw = document.getElementById('raw_diesel').value;
    }

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        alert('บันทึกข้อมูลเรียบร้อยแล้ว');
        
        // ล้างช่องกรอกข้อมูลหลังบันทึกสำเร็จ
        document.querySelectorAll('input[id^="raw_"]').forEach(input => {
            input.value = '';
            calcDays(input.id.replace('raw_', '')); // รีเซ็ตการแสดงผล
        });
    } catch(e) {
        alert('บันทึกสำเร็จ (โหมดจำลอง) / ไม่สามารถเชื่อมต่อ API ได้');
    }
    document.getElementById('loadingOverlay').classList.add('hidden');
}
