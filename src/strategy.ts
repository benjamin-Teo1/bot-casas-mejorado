import type { Movement, State, Direction, PieceId } from "./types.js";

const TAMAÑO = 10;
const DIRECCIONES: { dir: Direction; df: number; dc: number }[] = [
  { dir: "N", df: -1, dc: 0 },
  { dir: "S", df: 1, dc: 0 },
  { dir: "O", df: 0, dc: -1 },
  { dir: "E", df: 0, dc: 1 },
];

// Distancia toroidal mínima entre dos coordenadas en un eje (fila o columna)
function distanciaEje(a: number, b: number): number {
  const directa = Math.abs(a - b);
  return Math.min(directa, TAMAÑO - directa); // Comparamos la distancia directa con dar la vuelta por el borde
}

// Distancia Manhattan toroidal entre dos posiciones [fila, columna]
function distancia(pos1: [number, number], pos2: [number, number]): number {
  return distanciaEje(pos1[0], pos2[0]) + distanciaEje(pos1[1], pos2[1]); // Sumamos la distancia en filas y en columnas
}

// Recorre el tablero y devuelve todas las posiciones [fila, columna] que son "N"
function buscarCasas(state: State): [number, number][] {
  const casas: [number, number][] = [];
  for (let f = 0; f < TAMAÑO; f++) {
    for (let c = 0; c < TAMAÑO; c++) {
      if (state.tablero[f][c] === "N") casas.push([f, c]); // Si la celda es una casa neutral, la guardamos
    }
  }
  return casas;
}

// Dada una posición, encuentra la casa más cercana (o null si no hay ninguna)
function casaMasCercana(pos: [number, number], casas: [number, number][]): [number, number] | null {
  if (casas.length === 0) return null;
  // Usamos reduce para ir comparando y quedarnos con la casa que tenga menor distancia
  return casas.reduce((cercana, actual) => 
    distancia(pos, actual) < distancia(pos, cercana) ? actual : cercana
  );
}

// Aplica una dirección + dado a una posición, con wrap toroidal
function aplicarMovimiento(pos: [number, number], df: number, dc: number, dado: number): [number, number] {
  // Sumamos TAMAÑO antes del módulo (%) para evitar que los números negativos rompan el cálculo en JavaScript
  const nuevaFila = (pos[0] + df * dado + TAMAÑO) % TAMAÑO;
  const nuevaColumna = (pos[1] + dc * dado + TAMAÑO) % TAMAÑO;
  return [nuevaFila, nuevaColumna];
}

// ¿Se puede mover a la celda destino?
// Siempre vale si está vacía o es una casa "N". Si permitirPropias es true,
// también vale si ahí hay una ficha del jugador actual. Nunca vale si hay una ficha rival.
function esDestinoValido(state: State, destino: [number, number], permitirPropias: boolean): boolean {
  const [f, c] = destino;
  const celda = state.tablero[f][c];
  const libreOCasa = celda === "" || celda === "N"; // Vacía o casa neutral para conquistar
  const fichaPropia = permitirPropias && celda.startsWith(state.jugador); // Ficha nuestra, solo si nos dan permiso
  return libreOCasa || fichaPropia;
}

export function chooseMove(state: State): Movement {
  const movements: Movement = {};
  const casas = buscarCasas(state);
  // Destinos ya elegidos por otras fichas propias en este mismo turno
  const destinosUsados: [number, number][] = [];

  for (let f = 0; f < TAMAÑO; f++) {
    for (let c = 0; c < TAMAÑO; c++) {
      const celda = state.tablero[f][c];
      if (!celda.startsWith(state.jugador)) continue;

      const posActual: [number, number] = [f, c];
      const objetivo = casaMasCercana(posActual, casas);

      // Evaluar las 4 direcciones y quedarse con la mejor válida
      let mejorDireccion: Direction | null = null;
      let mejorDistancia = Infinity;
      let mejorDestino: [number, number] | null = null;

      // Buscamos por niveles: primero sin pisar fichas propias y,
      // solo si no hay ninguna dirección posible, permitiéndolo
      for (const permitirPropias of [false, true]) {
        for (const { dir, df, dc } of DIRECCIONES) {
          const destino = aplicarMovimiento(posActual, df, dc, state.dado);
          // Dos destinos son la misma casilla si coinciden fila y columna
          const yaUsado = destinosUsados.some(d => d[0] === destino[0] && d[1] === destino[1]);
          if (!esDestinoValido(state, destino, permitirPropias) || yaUsado) continue;

          const dist = objetivo ? distancia(destino, objetivo) : 0;
          if (dist < mejorDistancia) {
            mejorDistancia = dist;
            mejorDireccion = dir;
            mejorDestino = destino;
          }
        }
        if (mejorDireccion !== null) break; // Ya encontramos dirección: no hace falta la segunda vuelta
      }

      // Registramos el destino solo si fue una elección real.
      // El movimiento de emergencia no se anota: esa ficha probablemente no llegue
      // y no queremos bloquearle esa casilla a otra ficha propia que sí puede usarla.
      if (mejorDestino !== null) destinosUsados.push(mejorDestino);

      // Toda ficha propia tiene que aparecer en la respuesta. Si las 4 direcciones
      // están bloqueadas, mandamos "N" igual para no romper el formato del turno
      movements[celda as PieceId] = mejorDireccion ?? DIRECCIONES[0].dir;
    }
  }

  return movements;
}