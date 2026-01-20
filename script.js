/* -----------------------------------------------------------
   CONFIGURAÇÕES E INICIALIZAÇÃO
   ----------------------------------------------------------- */
const CLOUD_NAME = "dgagemtqg";
const UPLOAD_PRESET = "Gerenciador_Estudos";

const firebaseConfig = {
    apiKey: "AIzaSyDtziafcFDXZd9sGndXleqijouEIcqBeIk",
    authDomain: "gerenciador-de-estudos-9544b.firebaseapp.com",
    databaseURL: "https://gerenciador-de-estudos-9544b-default-rtdb.firebaseio.com",
    projectId: "gerenciador-de-estudos-9544b",
};

// Inicializa o Firebase e o Banco de Dados em tempo real
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Configura o "trabalhador" do PDF.js para processar os arquivos fora da thread principal
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

/* -----------------------------------------------------------
   ESTADO DA APLICAÇÃO (VARIÁVEIS GLOBAIS)
   ----------------------------------------------------------- */
let studyData = {
    folders: [],
    settings: { alarmInterval: 86400000, alarmActive: true }, // Default: 24h em milissegundos
};
let currentDay = new Date().getDay(); // Pega o dia atual (0-6)
let mode = "daily"; // Define se estamos vendo o dia ("daily") ou tudo ("all")
let activeFolderId = null; // ID da pasta aberta no momento
let activeFile = null; // Arquivo PDF sendo lido no momento
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* -----------------------------------------------------------
   SINCRONIZAÇÃO COM BANCO DE DATA (FIREBASE)
   ----------------------------------------------------------- */
// Escuta qualquer mudança no banco e atualiza a tela automaticamente
db.ref("studyData").on("value", (snap) => {
    const data = snap.val();
    if (data) {
        studyData = data;
        if (!studyData.settings)
            studyData.settings = { alarmInterval: 86400000, alarmActive: true };
        
        // Sincroniza os inputs de configuração da tela com os dados do banco
        document.getElementById("alarmInterval").value = studyData.settings.alarmInterval;
        document.getElementById("alarmActive").checked = studyData.settings.alarmActive;
    }
    render(); // Reconstroi a interface com os novos dados
});

/* -----------------------------------------------------------
   FUNÇÕES DE CONFIGURAÇÃO E NAVEGAÇÃO
   ----------------------------------------------------------- */
// Salva as novas preferências de alarme no Firebase
function updateAlarmSettings() {
    studyData.settings.alarmInterval = parseInt(document.getElementById("alarmInterval").value);
    studyData.settings.alarmActive = document.getElementById("alarmActive").checked;
    db.ref("studyData").set(studyData);
}

// Altera o dia da semana visualizado
function setDay(d) {
    currentDay = d;
    mode = "daily";
    activeFolderId = null; // Fecha pastas abertas ao trocar de dia
    render();
}

// Muda para o modo de visualização de todas as matérias
function viewAll() {
    mode = "all";
    activeFolderId = null;
    render();
}

/* -----------------------------------------------------------
   GERENCIAMENTO DE CRONOGRAMA
   ----------------------------------------------------------- */
// Permite definir manualmente em quais dias (0-6) uma matéria aparece
function manualSchedule(folderId) {
    const folder = studyData.folders.find((f) => f.id === folderId);
    const input = prompt(`Dias (0-6):`, folder.days.join(","));
    if (input !== null) {
        folder.days = input
            .split(",")
            .map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n));
        db.ref("studyData").set(studyData);
    }
}

// Distribui as matérias automaticamente (uma para cada dia da semana)
function autoDistribute() {
    if (studyData.folders.length === 0) return alert("Adicione matérias!");
    studyData.folders.forEach((folder, index) => {
        folder.days = [index % 7];
    });
    db.ref("studyData").set(studyData);
}

/* -----------------------------------------------------------
   UPLOAD E CLOUDINARY
   ----------------------------------------------------------- */
// Gerencia o envio de arquivos para o Cloudinary e salva os links no Firebase
async function handleUpload() {
    const fileInput = document.getElementById("fileInput");
    const files = fileInput.files;
    if (files.length === 0) return;
    const folderName = prompt("Nome da Matéria:");
    if (!folderName) return;

    document.getElementById("uploadPanel").style.display = "block";
    const list = document.getElementById("uploadList");
    list.innerHTML = "";

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Cria o item visual na lista de upload
        const item = document.createElement("div");
        item.className = "upload-item";
        item.id = "up-" + i;
        item.innerHTML = `<span>📄 ${file.name.substring(0, 12)}...</span><div class="spinner"></div>`;
        list.appendChild(item);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);
            
            // Envia para a API do Cloudinary
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { 
                method: "POST", body: formData 
            });
            const data = await resp.json();

            if (data.secure_url) {
                // Procura se a pasta já existe ou cria uma nova
                let folder = studyData.folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                if (!folder) {
                    folder = {
                        id: "f" + Date.now(),
                        name: folderName,
                        files: [],
                        days: [currentDay], // Adiciona ao dia que o usuário está vendo
                    };
                    studyData.folders.push(folder);
                }
                // Adiciona o novo arquivo com metadados de progresso e leitura
                folder.files.push({
                    id: "d" + Date.now(),
                    name: file.name,
                    url: data.secure_url.replace("http://", "https://"),
                    progress: 0,
                    lastScroll: 0,
                    lastRead: null,
                });
                await db.ref("studyData").set(studyData);
                document.getElementById("up-" + i).innerHTML = `<span>✅ Pronto</span>`;
            }
        } catch (e) {
            document.getElementById("up-" + i).innerHTML = `<span>❌ Erro</span>`;
        }
    }
    document.getElementById("uploadStatusTitle").innerText = "Concluído!";
    fileInput.value = "";
}

/* -----------------------------------------------------------
   VISUALIZADOR DE PDF (PDF.js)
   ----------------------------------------------------------- */
// Abre o arquivo PDF, renderiza as páginas em Canvas e gerencia o scroll
async function openPDF(folderId, fileId) {
    const folder = studyData.folders.find((f) => f.id === folderId);
    activeFile = folder.files.find((f) => f.id === fileId);
    activeFolderId = folderId;
    
    // Marca a data da leitura (essencial para o sistema de revisão)
    activeFile.lastRead = Date.now();
    db.ref("studyData").set(studyData);

    document.getElementById("viewer").style.display = "flex";
    const content = document.getElementById("viewerContent");
    content.innerHTML = "<h2>Carregando...</h2>";

    try {
        const pdf = await pdfjsLib.getDocument(activeFile.url).promise;
        content.innerHTML = "";
        
        // Loop para renderizar cada página do PDF
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.3 });
            const canvas = document.createElement("canvas");
            content.appendChild(canvas);
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
        }

        // Monitora o progresso da leitura através do scroll
        content.onscroll = () => {
            const totalH = content.scrollHeight - content.clientHeight;
            const perc = Math.round((content.scrollTop / totalH) * 100);
            document.getElementById("scrollPerc").innerText = perc + "%";
            activeFile.progress = perc;
            activeFile.lastScroll = content.scrollTop;
        };

        // Retorna para onde o usuário parou na última vez
        setTimeout(() => {
            content.scrollTop = activeFile.lastScroll || 0;
        }, 500);
    } catch (e) {
        alert("Erro ao abrir!");
    }
}

// Fecha o visualizador e salva o estado final no banco
// Substitua a função antiga por esta:
async function closeAndSave() {
    try {
        // O 'await' faz o código esperar o Firebase confirmar o salvamento
        await db.ref("studyData").set(studyData);
        
        // Só depois que salvou, ele esconde o visualizador
        document.getElementById("viewer").style.display = "none";
        
        // Atualiza a tela para mostrar a barra de progresso nova
        render(); 
        console.log("Progresso sincronizado com o Firebase.");
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Atenção: O progresso não foi salvo. Verifique sua conexão.");
    }
}
/* -----------------------------------------------------------
   RENDERIZAÇÃO DA INTERFACE (A FUNÇÃO MAIS IMPORTANTE)
   ----------------------------------------------------------- */
// Reconstrói todo o HTML da página baseado no estado atual (studyData)
function render() {
    const now = Date.now();
    const config = studyData.settings || { alarmInterval: 86400000, alarmActive: true };

    // 1. Renderiza o Dashboard Superior (Cards Pequenos)
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = studyData.folders.map((f) => {
        // Calcula a média de leitura da pasta
        const avg = f.files.length 
            ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) 
            : 0;

        // Verifica se algum arquivo precisa de revisão (tempo > intervalo)
        const needsRevision = config.alarmActive && f.files.some(
            file => file.lastRead && now - file.lastRead > config.alarmInterval
        );

        return `
            <div class="dash-card">
                ${needsRevision ? '<div class="revisao-badge">REVISAR</div>' : ""}
                <h4>📂 ${f.name}</h4>
                <div class="dash-perc">${avg}%</div>
                <div style="font-size:0.7em; color:#888;">Progresso</div>
            </div>`;
    }).join("");

    // 2. Atualiza os botões da barra da semana (Borda laranja e fundo azul)
    for (let i = 0; i <= 6; i++) {
        const btn = document.getElementById(`btn-day-${i}`);
        if (btn) {
            const hasContent = studyData.folders.some(f => f.days && f.days.includes(i));
            btn.classList.toggle("has-content", hasContent);
            btn.classList.toggle("active", i === currentDay && mode === "daily");
        }
    }

    // 3. Renderiza o Grid Principal (Pastas ou Arquivos)
    const grid = document.getElementById("grid");
    
    // MODO: DENTRO DE UMA PASTA (Vendo os PDFs)
    if (activeFolderId) {
        const folder = studyData.folders.find((f) => f.id === activeFolderId);
        document.getElementById("dayTitle").innerText = "📂 " + folder.name;
        grid.innerHTML = `<button onclick="activeFolderId=null; render()" class="btn btn-outline" style="grid-column:1/-1">⬅ Voltar</button>` +
            folder.files.map((file) => {
                const isLate = config.alarmActive && file.lastRead && now - file.lastRead > config.alarmInterval;
                return `
                <div class="card" onclick="openPDF('${folder.id}', '${file.id}')">
                    ${isLate ? '<div class="revisao-badge">REVISÃO</div>' : ""}
                    <button class="btn-del" onclick="deleteFile(event, '${folder.id}', '${file.id}')">×</button>
                    <h4>📄 ${file.name}</h4>
                    <div class="prog-container"><div class="prog-bar" style="width:${file.progress}%"></div></div>
                    <small>Visto: ${file.progress}%</small>
                </div>`;
            }).join("");
    } 
    // MODO: VENDO AS PASTAS (Matérias)
    else {
        let filtered = mode === "all" 
            ? studyData.folders 
            : studyData.folders.filter(f => f.days && f.days.includes(currentDay));

        document.getElementById("dayTitle").innerText = mode === "all" ? "Todas as Pastas" : "Cronograma de " + dayNames[currentDay];
        
        grid.innerHTML = filtered.map((f) => {
            const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
            const needsRevision = config.alarmActive && f.files.some(file => file.lastRead && now - file.lastRead > config.alarmInterval);
            const badges = (f.days || []).map(d => `<span class="day-tag">${dayNames[d]}</span>`).join("");
            
            return `
                <div class="card" onclick="activeFolderId='${f.id}'; render()">
                    ${needsRevision ? '<div class="revisao-badge">REVISAR</div>' : ""}
                    <button class="btn-del" onclick="deleteFolder(event, '${f.id}')">×</button>
                    <h3 style="margin-top:5px">📂 ${f.name}</h3>
                    <div style="margin-bottom:10px">${badges}</div>
                    <div class="prog-container"><div class="prog-bar" style="width:${avg}%"></div></div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px">
                        <small>${f.files.length} PDFs • <b>Média ${avg}%</b></small>
                        <button class="btn-outline" style="font-size:0.75em; padding:3px 6px" onclick="event.stopPropagation(); manualSchedule('${f.id}')">⚙️ Dias</button>
                    </div>
                </div>`;
        }).join("");
    }
}

/* -----------------------------------------------------------
   FUNÇÕES DE EXCLUSÃO
   ----------------------------------------------------------- */
// Exclui uma pasta (matéria) inteira
function deleteFolder(e, id) {
    e.stopPropagation(); // Impede que o clique abra a pasta antes de excluir
    if (confirm("Excluir Matéria e todos os arquivos?")) {
        studyData.folders = studyData.folders.filter((f) => f.id !== id);
        db.ref("studyData").set(studyData);
    }
}

// Exclui um arquivo PDF específico de dentro de uma pasta
function deleteFile(e, fid, id) {
    e.stopPropagation();
    const folder = studyData.folders.find((f) => f.id === fid);
    folder.files = folder.files.filter((f) => f.id !== id);
    db.ref("studyData").set(studyData);
}

// Inicia a renderização assim que a página carrega
window.onload = () => render();
