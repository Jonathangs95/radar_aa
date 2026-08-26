CANAL 360 - V5 PROBLEMA PRIMEIRO

MODO OFICIAL

1. Instale Node.js 20 ou superior.
2. Execute: npm run dev
3. O site abrira em http://localhost:8085

No PowerShell, se o comando npm for bloqueado pela Execution Policy, use:
npm.cmd run dev

ATUALIZACAO DOS DADOS

Substitua os arquivos em dados_fontes e execute:
npm run data:update

A carteira pode ser .xlsb ou .xlsx, desde que siga o padrao:
carteira_mes.ext

Exemplos:
- dados_fontes\carteira_julho.xlsb
- dados_fontes\carteira_agosto.xlsx
- dados_fontes\carteira_novembro.xlsb

Se houver mais de uma carteira na pasta, o script seleciona a competencia mais
recente pelo mes no nome. Para escolher manualmente:
npm run data:update -- --carteira dados_fontes\carteira_agosto.xlsx

BUILD PARA GITHUB/VERCEL

Execute:
npm run build

O build sera gerado em dist/. O Vercel usa as configuracoes de vercel.json:
- Build Command: npm run build
- Output Directory: dist

Os arquivos .bat ficaram apenas como atalhos legados. O fluxo oficial e via npm.
