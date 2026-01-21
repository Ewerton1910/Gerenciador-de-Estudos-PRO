const CLOUD_NAME = "dgagemtqg";
const UPLOAD_PRESET = "Gerenciador_Estudos";
const firebaseConfig = {
    apiKey: "AIzaSyDtziafcFDXZd9sGndXleqijouEIcqBeIk",
    authDomain: "gerenciador-de-estudos-9544b.firebaseapp.com",
    databaseURL: "https://gerenciador-de-estudos-9544b-default-rtdb.firebaseio.com",
    projectId: "gerenciador-de-estudos-9544b",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

let studyData = { folders: [], settings: { alarmInterval: 86400000, alarmActive: true } };
let currentDay = new Date().getDay();
let mode = "daily";
let activeFolderId = null;
let activeFile = null;
const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

db.ref("studyData").on("value", (snap) => {
    const data = snap.val();
    if (data) {
        studyData = data;
        if (!studyData.folders) studyData.folders = [];
        if (!studyData.settings) studyData.settings = { alarmInterval: 86400000, alarmActive: true };
        
        document.getElementById("alarmInterval").value = studyData.settings.alarmInterval;
        document.getElementById("alarmActive").checked = studyData.settings.alarmActive;
    }
    render();
});

async function saveAll() {
    try { await db.ref("studyData").set(studyData); } catch (e) { console.error(e); }
}

function updateAlarmSettings() {
    studyData.settings.alarmInterval = parseInt(document.getElementById("alarmInterval").value);
    studyData.settings.alarmActive = document.getElementById("alarmActive").checked;
    saveAll();
}

function setDay(d) { currentDay = d; mode = "daily"; activeFolderId = null; render(); }
function viewAll() { mode = "all"; activeFolderId = null; render(); }

async function handleUpload() {
    const fileInput = document.getElementById("fileInput");
    const files = fileInput.files;
    if (files.length === 0) return alert("Selecione arquivos primeiro!");
    const folderName = prompt("Para qual matéria?");
    if (!folderName) return;

    document.getElementById("uploadPanel").style.display = "block";
    const list = document.getElementById("uploadList");
    list.innerHTML = "";

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const item = document.createElement("div");
        item.className = "upload-item";
        item.innerHTML = `<span>${file.name.substring(0,20)}</span> <div class="spinner"></div>`;
        list.appendChild(item);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        try {
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: formData });
            const data = await resp.json();

            if (data.secure_url) {
                let folder = studyData.folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                if (!folder) {
                    folder = { id: "f" + Date.now(), name: folderName, files: [], days: [currentDay] };
                    studyData.folders.push(folder);
                }
                folder.files.push({
                    id: "d" + Date.now(), name: file.name, url: data.secure_url.replace("http://", "https://"), 
                    progress: 0, lastScroll: 0, lastRead: Date.now()
                });
                await saveAll();
                item.innerHTML = `<span>${file.name.substring(0,20)}</span> ✅`;
            }
        } catch (e) { item.innerHTML = `<span>Erro</span> ❌`; }
    }
}

async function openPDF(folderId, fileId) {
    const folder = studyData.folders.find(f => f.id === folderId);
    activeFile = folder.files.find(f => f.id === fileId);
    activeFolderId = folderId;
    activeFile.lastRead = Date.now(); // Atualiza ao abrir

    document.getElementById("viewer").style.display = "flex";
    document.getElementById("pdfNameTitle").innerText = activeFile.name;
    const content = document.getElementById("viewerContent");
    content.innerHTML = "<h3>Carregando PDF...</h3>";

    try {
        const pdf = await pdfjsLib.getDocument(activeFile.url).promise;
        content.innerHTML = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getPage(i).getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            content.appendChild(canvas);
            const context = canvas.getContext("2d");
            canvas.height = viewport.height; canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
        }
        content.onscroll = () => {
            const perc = Math.round((content.scrollTop / (content.scrollHeight - content.clientHeight)) * 100);
            document.getElementById("scrollPerc").innerText = perc + "%";
            activeFile.progress = perc;
            activeFile.lastScroll = content.scrollTop;
        };
        setTimeout(() => content.scrollTop = activeFile.lastScroll || 0, 500);
    } catch (e) { console.log(e); }
}

function closeAndSave() { saveAll(); document.getElementById("viewer").style.display = "none"; render(); }

// --- FUNÇÃO RENDER COM A LÓGICA DE PASTA CORRIGIDA ---
function render() {
    const now = Date.now();
    const config = studyData.settings || { alarmInterval: 86400000, alarmActive: true };
    const grid = document.getElementById("grid");

    if (activeFolderId) {
        // VISÃO INTERNA DA PASTA
        const folder = studyData.folders.find(f => f.id === activeFolderId);
        document.getElementById("dayTitle").innerText = "📂 " + folder.name;
        grid.innerHTML = `<button onclick="activeFolderId=null; render()" class="btn" style="grid-column:1/-1; margin-bottom:10px;">⬅ Voltar</button>` + 
        folder.files.map(file => {
            const isLate = config.alarmActive && file.lastRead && (now - file.lastRead > config.alarmInterval);
            return `
                <div class="card" onclick="openPDF('${folder.id}', '${file.id}')">
                    <button class="btn-del" onclick="deleteFile(event,'${folder.id}','${file.id}')">×</button>
                    <h4>📄 ${file.name}</h4>
                    <div class="prog-container"><div class="prog-bar" style="width:${file.progress}%"></div></div>
                    <div class="card-footer">
                        <small>${file.progress}% concluído</small>
                        ${isLate ? '<span class="revisao-badge-bottom">REVISÃO</span>' : ''}
                    </div>
                </div>`;
        }).join("");
    } else {
        // VISÃO GERAL DE MATÉRIAS
        const filtered = mode === "all" ? studyData.folders : studyData.folders.filter(f => f.days && f.days.includes(currentDay));
        document.getElementById("dayTitle").innerText = mode === "all" ? "Todas as Matérias" : dayNames[currentDay];
        
        grid.innerHTML = filtered.map(f => {
            const avg = f.files.length ? Math.round(f.files.reduce((a,b)=>a+b.progress,0)/f.files.length) : 0;
            
            // LÓGICA DA BORDA: Verifica se QUALQUER arquivo desta pasta está atrasado
            const pastaAtrasada = f.files && f.files.some(file => {
                return config.alarmActive && file.lastRead && (now - file.lastRead > config.alarmInterval);
            });

            return `
                <div class="card ${pastaAtrasada ? 'revisar-pasta' : ''}" onclick="activeFolderId='${f.id}'; render()">
                    ${pastaAtrasada ? '<span class="revisar-label-top">REVISAR</span>' : ''}
                    <button class="btn-del" onclick="deleteFolder(event,'${f.id}')">×</button>
                    <h3>📂 ${f.name}</h3>
                    <div class="prog-container"><div class="prog-bar" style="width:${avg}%"></div></div>
                    <small>${f.files.length} arquivos • ${avg}% médio</small>
                </div>`;
        }).join("");
    }

    // Botões de Dias
    for (let i = 0; i <= 6; i++) {
        const btn = document.getElementById(`btn-day-${i}`);
        if(btn) btn.className = `day-btn ${i === currentDay && mode === "daily" ? 'active' : ''} ${studyData.folders.some(f=>f.days && f.days.includes(i)) ? 'has-content' : ''}`;
    }
}

function deleteFolder(e, id) { e.stopPropagation(); if(confirm("Excluir pasta?")) { studyData.folders = studyData.folders.filter(f=>f.id!==id); saveAll(); } }
function deleteFile(e, fid, id) { e.stopPropagation(); const f = studyData.folders.find(f=>f.id===fid); f.files = f.files.filter(f=>f.id!==id); saveAll(); }

window.onload = () => render();
