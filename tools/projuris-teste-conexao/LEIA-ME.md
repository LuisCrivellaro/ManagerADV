# Teste de conexão com o ProJuris ADV (só leitura)

Roda no seu computador, para a chave nunca passar pelo chat nem por outro lugar. O teste obtém um token e faz
uma consulta de pessoas pedindo 1 registro. Ele imprime só se funcionou, o status HTTP, o total de registros e o
formato de autorização aceito. Não imprime a chave, o token nem dados de pessoas.

## Passo a passo

1. Instale o Node.js, versão LTS, em https://nodejs.org (uma vez só).
2. Copie esta pasta (`projuris-teste-conexao`) para o seu computador.
3. Dentro dela, crie um arquivo chamado `.env` com duas linhas, usando a chave **nova** do ProJuris:

   ```
   PROJURIS_CLIENT_ID=coloque_aqui_o_identificador
   PROJURIS_CLIENT_SECRET=coloque_aqui_a_chave
   ```

4. Abra o terminal nesta pasta e rode:

   ```
   node teste-conexao.mjs
   ```

5. Copie para o chat **só as linhas impressas** (no máximo três). Nunca envie o arquivo `.env`.
6. Depois do teste, apague o arquivo `.env`.

## Opcional: nomes dos campos

`node teste-conexao.mjs --estrutura` imprime também os **nomes** dos campos da resposta, sem nenhum valor.
Serve para confirmar o formato que o Manager ADV vai ler. Use só se a Dra. autorizar.
