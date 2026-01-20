# 📚 Gerenciador de Estudos PRO

Um sistema inteligente para gestão de materiais de estudo em PDF, focado em organização semanal e **Revisão Espaçada**. O projeto utiliza Firebase para armazenamento de dados em tempo real e Cloudinary para hospedagem de arquivos.



## ✨ Funcionalidades Principais

* **📂 Organização por Matérias:** Crie pastas específicas para cada disciplina.
* **📅 Cronograma Semanal:** Distribua suas matérias pelos dias da semana (Manual ou Automático).
* **⏰ Alerta de Estudo Espaçado:** Sistema inteligente que avisa quando é hora de revisar uma matéria (configurável para 24h, 2, 5 ou 7 dias).
* **📊 Dashboard de Progresso:** Visualize a média de leitura de cada matéria através de barras de progresso dinâmicas.
* **🚀 Upload Múltiplo:** Envie vários PDFs de uma vez com feedback de progresso estilo Google Drive.
* **📖 Visualizador Integrado:** Leia seus PDFs diretamente na plataforma com salvamento automático de onde você parou.

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3 (Moderno/Responsivo) e JavaScript (Vanilla).
* **Backend:** [Firebase Realtime Database](https://firebase.google.com/) para persistência de dados.
* **Storage:** [Cloudinary](https://cloudinary.com/) para armazenamento de arquivos PDF.
* **PDF Engine:** [PDF.js](https://mozilla.github.io/pdf.js/) para renderização de documentos no navegador.

## 🚀 Como Executar o Projeto

1.  Faça o clone deste repositório:
    ```bash
    git clone [https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git](https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git)
    ```
2.  Abra o arquivo `index.html` em seu navegador.
3.  *Nota:* O projeto já está configurado com as chaves de API necessárias para funcionamento imediato.

## 📸 Demonstração da Lógica de Revisão

O sistema utiliza a data da última leitura para calcular o momento ideal da revisão:
1.  **Leitura Realizada:** O sistema grava o timestamp exato.
2.  **Monitoramento:** Se o tempo decorrido ultrapassar o intervalo definido (ex: 24h), um selo vibrante **"REVISAR"** aparece no dashboard.
3.  **Reset:** Ao abrir o PDF novamente, o cronômetro é zerado para aquele arquivo.



## 🤝 Contribuições

Este é um projeto de código aberto. Sinta-se à vontade para abrir uma *Issue* ou enviar um *Pull Request* com melhorias visuais ou novas funcionalidades.

---
Desenvolvido com 💡 para facilitar a jornada de aprendizado.
