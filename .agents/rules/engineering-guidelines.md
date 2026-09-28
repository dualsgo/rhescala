# Diretrizes de Engenharia — Rhescala

Você está trabalhando em uma aplicação operacional real de gestão de escalas. Preserve comportamento existente. Não faça reescritas amplas sem necessidade.

## 1. Regra principal

Priorize:

1. segurança
2. correção
3. preservação das regras de negócio
4. testabilidade
5. manutenção
6. performance
7. estética

Não sacrifique regras existentes para simplificar código.

## 2. Antes de alterar

Antes de implementar uma mudança:

* leia `.agents/AGENTS.md`;
* identifique os arquivos envolvidos;
* procure implementações existentes da mesma regra;
* verifique se existe duplicação;
* determine se a mudança pertence à UI, domínio, aplicação ou infraestrutura;
* não implemente uma segunda versão de uma funcionalidade que já existe.

Nunca altere simultaneamente UI, motor de escala, autenticação e persistência em uma única tarefa, salvo quando a própria mudança exigir isso.

## 3. Regras de arquitetura

Componentes React devem cuidar principalmente de apresentação e interação.

Não coloque regras complexas de escala dentro de JSX.

Regras de negócio devem ser funções puras e independentes de React sempre que possível.

Não coloque chamadas de API diretamente em componentes quando elas puderem ser encapsuladas na camada de infraestrutura.

Não coloque dados de autenticação dentro da entidade `Employee`.

Não misture estado visual com estado de domínio sem necessidade.

Não criar prop apenas para transportar estado através de muitos níveis se existir uma abstração melhor.

Não criar novo contexto global sem justificar a necessidade.

## 4. Motor de escalas

O motor de escalas é código crítico.

Nunca alterar uma regra de:

* 6x1
* 5x2
* domingos
* carryover
* aprendiz
* feriados
* dias protegidos
* pico
* posições táticas
* almoço
* compliance

sem criar ou atualizar testes correspondentes.

As funções do domínio devem permanecer independentes de React, DOM, localStorage, fetch e componentes.

Evite `Date` espalhado em dezenas de lugares. Centralize funções de calendário quando possível.

## 5. Tipagem

Não criar novos `any`.

Não enfraquecer tipos existentes apenas para fazer o TypeScript aceitar determinada implementação.

Não utilizar `| string` em unions quando isso eliminar a validação desejada.

Propriedades derivadas não devem ser persistidas sem necessidade.

Tipos de domínio não devem carregar propriedades puramente visuais.

## 6. React

Evite componentes com responsabilidade excessiva.

Antes de adicionar código a um arquivo grande, verifique se a lógica pode ser extraída para:

* hook especializado
* função pura
* componente menor
* módulo de domínio
* serviço de aplicação

Não transformar um arquivo grande em vários arquivos apenas movendo o mesmo código sem reduzir acoplamento.

## 7. Segurança

Autorização deve acontecer no servidor.

`isReadOnly` no React nunca deve ser considerado mecanismo de segurança.

Toda operação administrativa deve ser validada no backend.

Não confiar em:

* role armazenada no navegador
* sessionStorage
* localStorage
* parâmetros enviados pelo cliente
* flags visuais

Não armazenar senhas dentro de objetos operacionais de colaboradores.

Nunca criar endpoints administrativos sem autenticação.

Nunca permitir alteração de senha sem validar a sessão e a permissão do usuário.

## 8. Persistência

Toda informação persistida deve ter contrato claro.

Para recursos compartilhados, considerar:

* versão
* timestamp
* autor
* conflito
* atualização concorrente

Não assumir que "último POST venceu" é uma estratégia segura para dados críticos.

Não retornar sucesso de persistência quando o armazenamento durável falhou.

## 9. Interface

Usar o design system existente.

Não inventar uma combinação diferente de:

* fonte
* espaçamento
* raio
* sombra
* cor
* animação

para cada tela.

Evitar excesso de:

* gradientes
* `font-black`
* `uppercase`
* `tracking-widest`
* textos menores que 11px
* sombras fortes
* animações contínuas
* badges redundantes

A interface deve parecer um produto operacional consistente, não uma coleção de telas independentes.

Elementos somente com ícone devem possuir nome acessível.

Modais devem possuir foco correto, suporte a Escape e semântica de diálogo.

## 10. Tailwind

Não adicionar classes indiscriminadamente.

Quando um padrão visual aparecer em três ou mais componentes, considerar transformá-lo em uma abstração do design system.

Não depender de CDN em produção quando a aplicação puder gerar CSS durante o build.

## 11. Arquivos gerados

Nunca editar manualmente artefatos gerados.

Antes de alterar `appscript_version/`, verificar se ele é produzido por `gas_fix.cjs`.

Alterar a fonte e regenerar o artefato.

## 12. Dependências

Não adicionar biblioteca apenas para resolver um problema simples.

Antes de adicionar dependência:

* verificar se React, TypeScript ou Vite já resolvem o problema;
* avaliar impacto no bundle;
* avaliar manutenção;
* explicar a necessidade.

## 13. Escopo

Uma tarefa deve possuir um objetivo principal.

Não aproveitar uma tarefa de UI para refatorar o motor.

Não aproveitar uma tarefa do motor para reorganizar autenticação.

Não fazer "melhorias extras" que aumentem o risco da alteração.

## 14. Verificação obrigatória

Após uma alteração:

1. executar typecheck;
2. executar lint;
3. executar testes;
4. executar build;
5. verificar se não houve alterações acidentais em arquivos não relacionados.

Se algum desses passos falhar, não considerar a tarefa concluída.

## 15. Testes

Toda regra crítica nova ou alterada deve possuir teste.

Prioridade de cobertura:

* geração 6x1
* geração 5x2
* carryover
* domingos
* feriados
* aprendiz
* dias protegidos
* otimização de pico
* posições táticas
* diff
* conflitos de sincronização
* permissões

## 16. Mudanças graduais

Prefira cinco mudanças pequenas e verificáveis a uma grande refatoração.

Antes:

* entender
* testar
* modificar
* verificar

Nunca:

* reescrever tudo
* tentar corrigir toda a arquitetura em uma tarefa
* remover código "aparentemente redundante" sem provar que está morto

## 17. Formato da resposta após uma tarefa

Sempre informar:

### Alterado

O que foi modificado.

### Motivo

Por que a solução foi escolhida.

### Risco

O que pode ter sido afetado.

### Validação

Quais comandos foram executados e seus resultados.

### Próximo gargalo

Caso exista uma dívida técnica relevante que permaneceu fora do escopo.

Não declarar uma tarefa como concluída se o código não foi validado.
