
# Biblioteca lamejs para Web Workers

Este diretório contém a biblioteca lamejs para codificação MP3 em Web Workers.

## Instruções de Configuração

1. Copie o arquivo `lame.all.js` de `node_modules/lamejs/lame.all.js` para esta pasta (`public/libs/lamejs/lame.all.js`).
2. Nenhuma modificação no arquivo é necessária, apenas uma cópia direta.
3. Verifique se o arquivo está acessível visitando: `http://localhost:5173/libs/lamejs/lame.all.js` (ajuste a URL conforme a porta do seu servidor de desenvolvimento).

Esta configuração é necessária porque Web Workers não podem importar módulos npm diretamente, então precisamos disponibilizar a biblioteca publicamente.

## Nota de Implementação

O Web Worker em nosso conversor de áudio carrega esta biblioteca usando:

```javascript
importScripts('./libs/lamejs/lame.all.js');
```

Isso dá ao worker acesso a um objeto global `lamejs` que contém a funcionalidade de codificação MP3.

## Solução de Problemas

Se o conversor continuar a usar WAV em vez de MP3, verifique:

1. Se você copiou corretamente o arquivo `lame.all.js` para a pasta correta
2. Se o arquivo está acessível pela URL correta (teste no navegador)
3. Se não há erros no console relacionados ao carregamento da biblioteca
