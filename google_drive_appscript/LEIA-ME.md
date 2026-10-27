# Rhescala — Versão Enxuta para Google Apps Script (Google Drive)

Esta pasta contém a conversão isolada do **Rhescala** focada estritamente em **Grade (`ShiftGrid`) + Configurações (`Equipe`, `Jornada`, `Feriados`, `Drive & Sistema`) + Lógicas (`Motor CLT 6x1/5x2`, `Domingos`, `Dias Protegidos`, `Presets`, `Inconsistências`)** para rodar **100% direto no Google Drive / Google Apps Script**, **sem alterar nenhum arquivo do projeto original**.

## Arquivos de Implementação

| Arquivo | Tamanho | Onde colar no Google Apps Script | Função |
| :--- | :--- | :--- | :--- |
| `Code.gs` | ~18.9 KB | `Código.gs` (ou `Code.gs`) | Servidor `HtmlService` (aceita `Index` ou `index`), criação automática da pasta e planilha banco no Google Drive, autenticação, backup no Drive, suporte a JSON > 50k caracteres e `LockService`. |
| `Index.html` | ~494 KB | `Index.html` (arquivo HTML com nome `Index`) | Versão enxuta compilada com linhas curtas (~500–1300 chars), zero crases, tags `<script` internas escapadas e blindagem de `localStorage` para o sandbox do GAS. |

## Como Atualizar no Google Apps Script

1. No editor do **Google Apps Script**:
   - Substitua o conteúdo de **`Código.gs`** pelo novo **`Code.gs`**.
   - Substitua o conteúdo de **`Index.html`** pelo novo **`Index.html`**.
   - Comando rápido no PowerShell para copiar o `Index.html` inteiro sem risco de truncar:
     ```powershell
     Get-Content .\google_drive_appscript\Index.html -Raw -Encoding UTF8 | Set-Clipboard
     ```
2. Clique em **Salvar** (💾).
3. **Importante (Atualizar Implantação)**:
   - Se você já tinha criado uma implantação antes, vá em **Implantar** → **Gerenciar implantações** → clique no **ícone de lápis (Editar)** → em *Versão*, selecione **Nova versão** → clique em **Implantar** *(ou use o link de teste `/dev` em "Testar implantações")*.

## Como Recompilar no Futuro

```powershell
node google_drive_appscript/gerar-appscript.mjs
```
