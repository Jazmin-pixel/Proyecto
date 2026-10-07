import { describe, expect, it } from "vitest"
import {
  avisar,
  crearEstado,
  drenar,
  obtenerResumen,
  terminarTurno,
  type Estado,
  type Zona,
} from "../src/juego"

function crearEstadoControlado(
  ajustes: Partial<Omit<Zona, "fila" | "columna">> = {},
  opciones: Partial<Omit<Estado, "zonas">> = {},
): Estado {
  const zonas = Array.from({ length: 25 }, (_, indice): Zona => {
    const fila = Math.floor(indice / 5)
    const columna = indice % 5

    return {
      fila,
      columna,
      familias: 1,
      agua: 0,
      quebrada: fila === 4,
      inundada: false,
      evacuada: false,
      ...ajustes,
    }
  })

  return {
    zonas,
    turno: 1,
    accionesRestantes: 3,
    resultado: "en curso",
    ...opciones,
  }
}

describe("creación del tablero", () => {
  it("arma un tablero con 25 zonas distribuidas en una cuadrícula de 5 por 5", () => {
    const estado = crearEstado(123)

    expect(estado.zonas).toHaveLength(25)
    expect(estado.zonas.map(({ fila, columna }) => [fila, columna])).toEqual(
      Array.from({ length: 25 }, (_, indice) => [
        Math.floor(indice / 5),
        indice % 5,
      ]),
    )
    expect(estado.zonas.slice(20).every((zona) => zona.quebrada)).toBe(true)
    expect(estado.zonas.slice(0, 20).every((zona) => !zona.quebrada)).toBe(
      true,
    )
  })

  it("genera el mismo tablero para la misma semilla", () => {
    expect(crearEstado(456)).toEqual(crearEstado(456))
  })

  it("genera tableros distintos para semillas distintas", () => {
    expect(crearEstado(456).zonas).not.toEqual(crearEstado(457).zonas)
  })
})

describe("acciones del jugador", () => {
  it("avisa una zona no inundada, la evacúa y consume una acción", () => {
    const estado = crearEstadoControlado()

    expect(avisar(estado, 0, 0)).toBe(true)
    expect(estado.zonas[0].evacuada).toBe(true)
    expect(estado.accionesRestantes).toBe(2)
    expect(obtenerResumen(estado).familiasSalvadas).toBe(1)
  })

  it("no avisa una zona inundada, una zona ya evacuada ni una posición inexistente", () => {
    const estado = crearEstadoControlado()
    estado.zonas[0].inundada = true
    estado.zonas[1].evacuada = true

    expect(avisar(estado, 0, 0)).toBe(false)
    expect(avisar(estado, 0, 1)).toBe(false)
    expect(avisar(estado, 5, 0)).toBe(false)
    expect(estado.accionesRestantes).toBe(3)
  })

  it("drena tres niveles en la zona elegida y uno en cada vecina ortogonal", () => {
    const estado = crearEstadoControlado({ agua: 3 })

    expect(drenar(estado, 2, 2)).toBe(true)
    expect(estado.zonas[12].agua).toBe(0)
    expect(estado.zonas[7].agua).toBe(2)
    expect(estado.zonas[11].agua).toBe(2)
    expect(estado.zonas[13].agua).toBe(2)
    expect(estado.zonas[17].agua).toBe(2)
    expect(estado.zonas[6].agua).toBe(3)
    expect(estado.accionesRestantes).toBe(2)
  })

  it("no reduce el agua por debajo de cero al drenar", () => {
    const estado = crearEstadoControlado({ agua: 1 })

    expect(drenar(estado, 2, 2)).toBe(true)
    expect(estado.zonas.every((zona) => zona.agua >= 0)).toBe(true)
  })

  it("no drena una posición inexistente", () => {
    const estado = crearEstadoControlado()

    expect(drenar(estado, -1, 0)).toBe(false)
    expect(estado.accionesRestantes).toBe(3)
  })

  it("permite drenar una zona inundada sin recuperar sus familias", () => {
    const estado = crearEstadoControlado({ agua: 3, inundada: true })

    expect(drenar(estado, 0, 0)).toBe(true)
    expect(estado.zonas[0].agua).toBe(0)
    expect(estado.zonas[0].inundada).toBe(true)
    expect(obtenerResumen(estado).familiasPerdidas).toBe(25)
  })

  it("no permite actuar cuando no quedan acciones disponibles", () => {
    const estado = crearEstadoControlado({}, { accionesRestantes: 0 })
    const aguaAntes = estado.zonas.map((zona) => zona.agua)

    expect(avisar(estado, 0, 0)).toBe(false)
    expect(drenar(estado, 0, 0)).toBe(false)
    expect(estado.accionesRestantes).toBe(0)
    expect(estado.zonas.map((zona) => zona.agua)).toEqual(aguaAntes)
  })

  it("no permite actuar una vez finalizada la partida", () => {
    const estado = crearEstadoControlado({}, { resultado: "perdida" })

    expect(avisar(estado, 0, 0)).toBe(false)
    expect(drenar(estado, 0, 0)).toBe(false)
  })
})

describe("finalización de turnos y resultados", () => {
  it("suma la lluvia, inunda al llegar a seis y habilita tres acciones en el turno siguiente", () => {
    const estado = crearEstadoControlado({ agua: 4 })
    estado.zonas[0].quebrada = false
    estado.zonas[20].agua = 4
    estado.zonas[20].quebrada = true

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.zonas[0].agua).toBe(5)
    expect(estado.zonas[0].inundada).toBe(false)
    expect(estado.zonas[20].agua).toBe(6)
    expect(estado.zonas[20].inundada).toBe(true)
    expect(estado.turno).toBe(2)
    expect(estado.accionesRestantes).toBe(3)
  })

  it("gana al llegar al final con al menos el 70 por ciento de las familias salvadas", () => {
    const estado = crearEstadoControlado()
    estado.turno = 8
    estado.zonas.slice(0, 18).forEach((zona) => {
      zona.evacuada = true
    })

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.resultado).toBe("ganada")
    expect(obtenerResumen(estado).familiasSalvadas).toBe(18)
  })

  it("pierde al llegar al final con menos del 70 por ciento de las familias salvadas", () => {
    const estado = crearEstadoControlado()
    estado.turno = 8
    estado.zonas.slice(0, 17).forEach((zona) => {
      zona.evacuada = true
    })

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.resultado).toBe("perdida")
    expect(obtenerResumen(estado).familiasSalvadas).toBe(17)
  })

  it("pierde antes del final cuando ya no es posible alcanzar la meta", () => {
    const estado = crearEstadoControlado({ inundada: true })
    estado.zonas.slice(0, 17).forEach((zona) => {
      zona.inundada = false
      zona.evacuada = true
    })

    expect(terminarTurno(estado)).toBe(true)
    expect(estado.resultado).toBe("perdida")
  })

  it("no finaliza otra vez una partida que ya terminó", () => {
    const estado = crearEstadoControlado({}, { resultado: "ganada" })

    expect(terminarTurno(estado)).toBe(false)
    expect(estado.turno).toBe(1)
  })
})

describe("conservación de familias y partidas completas", () => {
  it("mantiene constante el total de familias durante todas las acciones y turnos", () => {
    const estado = crearEstado(789)
    const totalInicial = obtenerResumen(estado).familiasTotales

    for (let turno = 0; turno < 3 && estado.resultado === "en curso"; turno += 1) {
      estado.zonas.slice(0, 3).forEach((zona) => {
        if (!zona.inundada && !zona.evacuada && estado.accionesRestantes > 0) {
          avisar(estado, zona.fila, zona.columna)
        }
      })
      terminarTurno(estado)
      expect(obtenerResumen(estado).familiasTotales).toBe(totalInicial)
    }
  })

  it("puede ganar una partida completa avisando primero las zonas más expuestas y numerosas", () => {
    const estado = crearEstado(37)
    const totalInicial = obtenerResumen(estado).familiasTotales

    while (estado.resultado === "en curso") {
      const candidatas = estado.zonas
        .filter((zona) => !zona.inundada && !zona.evacuada)
        .sort(
          (primera, segunda) =>
            segunda.familias * (segunda.agua + (segunda.quebrada ? 2 : 1)) -
              primera.familias *
                (primera.agua + (primera.quebrada ? 2 : 1)) ||
            segunda.familias - primera.familias,
        )

      while (
        estado.accionesRestantes > 0 &&
        candidatas.length > 0 &&
        estado.resultado === "en curso"
      ) {
        const zona = candidatas.shift()
        if (zona) {
          avisar(estado, zona.fila, zona.columna)
        }
      }

      if (estado.resultado === "en curso") {
        terminarTurno(estado)
      }

      expect(obtenerResumen(estado).familiasTotales).toBe(totalInicial)
    }

    expect(estado.resultado).toBe("ganada")
    expect(obtenerResumen(estado).familiasSalvadas).toBeGreaterThanOrEqual(
      obtenerResumen(estado).metaFamilias,
    )
  })

  it("termina en derrota una partida completa en la que no se hace nada", () => {
    const estado = crearEstado(37)

    while (estado.resultado === "en curso") {
      expect(terminarTurno(estado)).toBe(true)
    }

    expect(estado.resultado).toBe("perdida")
    expect(obtenerResumen(estado).familiasSalvadas).toBe(0)
  })
})
