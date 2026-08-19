# Canal 360

Projeto estatico do painel Canal 360, pronto para rodar por scripts oficiais de
Node/npm e publicar no Vercel sem depender dos arquivos `.bat`.

## Requisitos

- Node.js 20 ou superior
- Python 3 somente quando for atualizar os dados a partir dos Excel/XLSB

## Rodar localmente

```bash
npm run dev
```

O site abre em `http://localhost:8085` servindo a pasta `demo/`.

No PowerShell do Windows, se `npm` for bloqueado pela Execution Policy, use:

```powershell
npm.cmd run dev
```

## Atualizar dados

Substitua os arquivos em `dados_fontes/` e execute:

```bash
npm run data:update
```

Esse comando instala as bibliotecas Python de `requirements_data.txt` e gera
`demo/data/channel-data.json`.

A carteira aceita arquivos `.xlsb` e `.xlsx` com nome no padrao
`carteira_mes.ext`, por exemplo:

- `dados_fontes/carteira_julho.xlsb`
- `dados_fontes/carteira_agosto.xlsx`
- `dados_fontes/carteira_novembro.xlsb`

Se houver mais de uma carteira na pasta, o script seleciona a competencia mais
recente pelo mes no nome. Para escolher manualmente:

```bash
npm run data:update -- --carteira dados_fontes/carteira_agosto.xlsx
```

## Gerar build oficial

```bash
npm run build
```

O conteudo final fica em `dist/`. Para conferir localmente:

```bash
npm run preview
```

## Publicar no Vercel

Ao conectar este projeto no Vercel, use a raiz do repositorio. O arquivo
`vercel.json` ja define:

- Build Command: `npm run build`
- Output Directory: `dist`

Antes de enviar para o GitHub/Vercel, rode `npm run data:update` quando houver
alteracao nos Excel/XLSB e confirme se `demo/data/channel-data.json` foi
atualizado.

Se o repositorio for publico, revise se `dados_fontes/` pode ser versionado,
porque esses arquivos podem conter dados internos.
