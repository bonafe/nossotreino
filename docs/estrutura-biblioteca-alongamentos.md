# Estrutura da biblioteca de alongamentos

## Alterações realizadas

- `schemaVersion`: `1.3` → `1.4`
- Nova entrada: `bibliotecas.alongamentos`
- Total de alongamentos: **122**
- Novos grupos musculares: **8**
- Novos equipamentos/acessórios: **3**

## Estrutura de cada alongamento

```json
{
  "id": "identificador-normalizado",
  "nome": "Nome legível",
  "descricao": "Posição inicial + movimento + posição final",
  "aliases": [],
  "classificacao": {
    "categoria": "alongamento",
    "tipo": "estatico-passivo | estatico-ativo | dinamico | mobilidade-articular",
    "nivelTecnico": "iniciante | intermediario",
    "finalidades": [],
    "momentoRecomendado": ""
  },
  "movimento": {
    "padrao": "",
    "lateralidade": "bilateral | unilateral | alternado"
  },
  "gruposMusculares": {
    "principais": [],
    "secundarios": [],
    "estabilizadores": []
  },
  "anatomia": {
    "musculosPrincipais": [],
    "musculosSecundarios": [],
    "estruturasAlvo": [],
    "articulacoesPrincipais": [],
    "movimentosArticulares": []
  },
  "equipamentos": {
    "obrigatorios": [],
    "opcionais": []
  },
  "metricas": {
    "padrao": "tempo | repeticoes",
    "permitidas": []
  },
  "dosagem": {
    "duracaoSegundos": {},
    "repeticoesPorLado": {},
    "series": {}
  },
  "execucao": {
    "instrucoes": [],
    "respiracao": [],
    "errosComuns": [],
    "cuidados": []
  },
  "relacoes": {
    "alternativos": [],
    "progressoes": [],
    "regressoes": [],
    "variacoes": []
  },
  "restricoes": [],
  "guiaImagem": {
    "quantidadeQuadros": 2,
    "orientacaoPrincipal": "",
    "posicaoInicial": "",
    "posicaoFinal": "",
    "pontosVisuaisObrigatorios": [],
    "setasMovimento": [],
    "errosVisuaisAEvitar": [],
    "destaqueAnatomico": {}
  },
  "midia": {
    "videoUrl": null,
    "videoMagnet": null,
    "thumbnail": null
  },
  "tags": [],
  "status": "ativo",
  "versao": 1,
  "qualidadeDados": {}
}
```

## Cobertura

A biblioteca cobre pescoço, ombros, manguito rotador, peitoral, costas, braços,
antebraços, punhos, mãos, dedos, coluna cervical/torácica/lombar, caixa torácica,
abdômen, quadril, glúteos, rotadores, adutores, quadríceps, posteriores de coxa,
joelhos, panturrilhas, tornozelos, pés, fáscia plantar, hálux e demais dedos dos pés.

### Tipos

- `dinamico`: 5
- `estatico-passivo`: 100
- `mobilidade-articular`: 17

### Principais grupos por quantidade de entradas

- `gluteos`: 21
- `costas`: 19
- `pes-e-dedos`: 16
- `panturrilhas`: 15
- `posteriores-de-coxa`: 15
- `flexores-do-quadril`: 13
- `ombros`: 12
- `pescoco`: 11
- `peitoral`: 11
- `antebracos`: 9
- `maos-e-dedos`: 9
- `rotadores-do-quadril`: 9
- `adutores`: 9
- `lombar`: 8
- `abdomen`: 8
- `quadriceps`: 7
- `tibial-anterior`: 7
- `trapezio`: 6
- `intercostais`: 6
- `biceps`: 5
- `quadrado-lombar`: 4
- `tibial-posterior`: 4
- `triceps`: 3
- `manguito-rotador`: 3
- `tensor-da-fascia-lata`: 3
- `fibulares`: 3
- `serratil-anterior`: 1

## Observações para geração de imagens

Cada item possui `guiaImagem` com:
- posição inicial e posição final;
- mãos e pés sempre visíveis;
- pontos de apoio;
- alinhamentos articulares;
- setas de movimento;
- erros visuais a evitar;
- músculos que devem receber destaque anatômico.
