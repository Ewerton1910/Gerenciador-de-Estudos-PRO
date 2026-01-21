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
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Listener do Firebase - Carrega os dados e chama o Render
db.ref("studyData").on("value", (snap) => {
    const data = snap.val();
    if (data) {
        studyData = data;
        if (!studyData.folders) studyData.folders = [];
        if (!studyData.settings) studyData.settings = { alarmInterval: 86400000, alarmActive: true };
        
        const intervalEl = document.getElementById("alarmInterval");
        const activeEl = document.getElementById("alarmActive");
        if(intervalEl) intervalEl.value = studyData.settings.alarmInterval;
        if(activeEl) activeEl.checked = studyData.settings.alarmActive;
    }
    render();
});

async function saveAll() {
    try {
        await db.ref("studyData").set(studyData);
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

function setDay(d) {
    currentDay = d;
    mode = "daily";
    activeFolderId = null;
    render();
}

function viewAll() {
    mode = "all";
    activeFolderId = null;
    render();
}

function manualSchedule(folderId) {
    const folder = studyData.folders.find((f) => f.id === folderId);
    const input = prompt(`Dias (0-6):`, folder.days.join(","));
    if (input !== null) {
        folder.days = input.split(",").map((n) => parseInt(n.trim())).filter((n) => !isNaN(n));
        saveAll();
    }
}

async function handleUpload() {
    const fileInput = document.getElementById("fileInput");
    const files = fileInput.files;
    if (files.length === 0) return;
    const folderName = prompt("Nome da Matéria:");
    if (!folderName) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { 
                method: "POST", 
                body: formData 
            });
            const data = await resp.json();

            if (data.secure_url) {
                let folder = studyData.folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                if (!folder) {
                    folder = { id: "f" + Date.now(), name: folderName, files: [], days: [currentDay] };
                    studyData.folders.push(folder);
                }
                folder.files.push({
                    id: "d" + Date.now(),
                    name: file.name,
                    url: data.secure_url.replace("http://", "https://"),
                    progress: 0,
                    lastScroll: 0,
                    lastRead: Date.now()
                });
                await saveAll();
            }
        } catch (e) {
            console.error("Erro no upload:", e);
        }
    }
    fileInput.value = "";
}

async function openPDF(folderId, fileId) {
    const folder = studyData.folders.find((f) => f.id === folderId);
    activeFile = folder.files.find((f) => f.id === fileId);
    activeFolderId = folderId;

    const viewer = document.getElementById("viewer");
    viewer.style.display = "flex";
    
    // POSIÇÃO: Porcentagem na ESQUERDA | Botão na DIREITA
    viewer.innerHTML = `
        <div class="viewer-header">
            <span id="scrollPerc" style="font-weight:bold; font-size:1.2em;">${activeFile.progress || 0}%</span>
            <button onclick="closeAndSave()" class="btn btn-danger">Salvar e Fechar</button>
        </div>
        <div id="viewerContent"><h2>Carregando PDF...</h2></div>
    `;

    const content = document.getElementById("viewerContent");

    try {
        const pdf = await pdfjsLib.getDocument(activeFile.url).promise;
        content.innerHTML = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.4 });
            const canvas = document.createElement("canvas");
            content.appendChild(canvas);
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
        }

        content.onscroll = () => {
            const totalH = content.scrollHeight - content.clientHeight;
            if (totalH <= 0) return;
            const perc = Math.round((content.scrollTop / totalH) * 100);
            document.getElementById("scrollPerc").innerText = perc + "%";
            activeFile.progress = perc;
            activeFile.lastScroll = content.scrollTop;
            activeFile.lastRead = Date.now();
        };

        setTimeout(() => { 
            content.scrollTop = activeFile.lastScroll || 0; 
        }, 500);

    } catch (e) {
        alert("Erro ao abrir PDF!");
    }
}

async function closeAndSave() {
    await saveAll();
    document.getElementById("viewer").style.display = "none";
    render();
}

function render() {
    const now = Date.now();
    const config = studyData.settings || { alarmInterval: 86400000, alarmActive: true };

    // Dashboard
    const dashboard = document.getElementById("dashboard");
    if(dashboard && studyData.folders) {
        dashboard.innerHTML = studyData.folders.map((f) => {
            const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
            return `<div class="dash-card">
                        <h4>📂 ${f.name}</h4>
                        <div class="dash-perc">${avg}%</div>
                    </div>`;
        }).join("");
    }

    // Botões da Semana
    for (let i = 0; i <= 6; i++) {
        const btn = document.getElementById(`btn-day-${i}`);
        if (btn) {
            const hasContent = studyData.folders.some(f => f.days && f.days.includes(i));
            btn.classList.toggle("has-content", hasContent);
            btn.classList.toggle("active", i === currentDay && mode === "daily");
        }
    }

    const grid = document.getElementById("grid");
    if (!grid) return;

    if (activeFolderId) {
        const folder = studyData.folders.find((f) => f.id === activeFolderId);
        document.getElementById("dayTitle").innerText = "📂 " + folder.name;
        grid.innerHTML = `<button onclick="activeFolderId=null; render()" class="btn" style="grid-column:1/-1; margin-bottom:15px">⬅ Voltar</button>` +
            folder.files.map((file) => `
                <div class="card" onclick="openPDF('${folder.id}', '${file.id}')">
                    <button class="btn-del" onclick="deleteFile(event, '${folder.id}', '${file.id}')">×</button>
                    <h4>📄 ${file.name}</h4>
                    <div class="prog-container"><div class="prog-bar" style="width:${file.progress}%"></div></div>
                    <div class="card-footer"><small>${file.progress}%</small></div>
                </div>`).join("");
    } else {
        let filtered = mode === "all" ? studyData.folders : studyData.folders.filter(f => f.days && f.days.includes(currentDay));
        document.getElementById("dayTitle").innerText = mode === "all" ? "Todas as Pastas" : "Cronograma de " + dayNames[currentDay];
        grid.innerHTML = filtered.map((f) => {
            const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
            return `
            <div class="card" onclick="activeFolderId='${f.id}'; render()">
                <button class="btn-del" onclick="deleteFolder(event, '${f.id}')">×</button>
                <h3>📂 ${f.name}</h3>
                <div class="prog-container"><div class="prog-bar" style="width:${avg}%"></div></div>
                <div class="card-footer">
                    <small>${f.files.length} PDFs • ${avg}%</small>
                    <button class="btn" style="padding:5px" onclick="event.stopPropagation(); manualSchedule('${f.id}')">⚙️</button>
                </div>
            </div>`;
        }).join("");
    }
}

function deleteFolder(e, id) {
    e.stopPropagation();
    if (confirm("Excluir pasta?")) {
        studyData.folders = studyData.folders.filter((f) => f.id !== id);
        saveAll();
    }
}

function deleteFile(e, fid, id) {
    e.stopPropagation();
    const folder = studyData.folders.find((f) => f.id === fid);
    folder.files = folder.files.filter((f) => f.id !== id);
    saveAll();
}

window.onload = () => render();
