// Modelo para la evaluación de usuarios
export interface UserEvaluation {
  id?: string;
  userId: string;
  userName: string;
  evaluatedBy: string;
  evaluatedAt: any;  // Puede ser Date o Firestore Timestamp
  
  // Evaluación de Canto (1-4 puntos cada uno)
  canto: {
    afinacion: number;      // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    rangoVocal: number;     // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    controlVocal: number;   // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    expresividad: number;   // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
  };
  
  // Evaluación de Instrumento (1-4 puntos cada uno)
  instrumento: {
    tecnica: number;        // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    precision: number;      // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    creatividad: number;    // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    versatilidad: number;   // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
  };
  
  // Evaluación de Compromiso (1-4 puntos cada uno)
  compromiso: {
    asistenciaEnsayos: number;      // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    participacionEventos: number;   // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
    colaboracion: number;           // 1=Básico, 2=Aceptable, 3=Bueno, 4=Excelente
  };
  
  // Puntuaciones calculadas
  puntuacionTotal: number;  // Suma de todos los criterios (máximo 44)
  nivel: number;           // Nivel calculado (1-6)
  impuestoPorcentaje: number; // Porcentaje de impuesto según nivel
  
  // Comentarios opcionales
  comentarios?: string;
}

// Interfaces para facilitar el manejo de datos
export interface EvaluationCriteria {
  name: string;
  description: string;
  levels: {
    value: number;
    label: string;
    description: string;
  }[];
}

export interface LevelConfiguration {
  nivel: number;
  nombre: string;
  descripcion: string;
  puntuacionMin: number;
  puntuacionMax: number;
  impuestoPorcentaje: number;
}

// Configuración de niveles según el sistema propuesto
export const LEVEL_CONFIGURATIONS: LevelConfiguration[] = [
  {
    nivel: 1,
    nombre: 'Nivel 1 (Máximo)',
    descripcion: 'Habilidades excepcionales y compromiso sobresaliente',
    puntuacionMin: 37,
    puntuacionMax: 44,
    impuestoPorcentaje: 40
  },
  {
    nivel: 2,
    nombre: 'Nivel 2',
    descripcion: 'Habilidades muy buenas y alto compromiso',
    puntuacionMin: 31,
    puntuacionMax: 36,
    impuestoPorcentaje: 50
  },
  {
    nivel: 3,
    nombre: 'Nivel 3',
    descripcion: 'Habilidades buenas y compromiso constante',
    puntuacionMin: 25,
    puntuacionMax: 30,
    impuestoPorcentaje: 55
  },
  {
    nivel: 4,
    nombre: 'Nivel 4',
    descripcion: 'Habilidades aceptables y compromiso regular',
    puntuacionMin: 19,
    puntuacionMax: 24,
    impuestoPorcentaje: 60
  },
  {
    nivel: 5,
    nombre: 'Nivel 5',
    descripcion: 'Habilidades básicas y compromiso ocasional',
    puntuacionMin: 13,
    puntuacionMax: 18,
    impuestoPorcentaje: 65
  },
  {
    nivel: 6,
    nombre: 'Nivel 6 (Mínimo)',
    descripcion: 'Habilidades limitadas y compromiso mínimo',
    puntuacionMin: 6,
    puntuacionMax: 12,
    impuestoPorcentaje: 70
  }
];

// Criterios de evaluación detallados
export const EVALUATION_CRITERIA: { [key: string]: EvaluationCriteria } = {
  // Canto
  afinacion: {
    name: 'Afinación',
    description: 'Capacidad de mantener la nota correcta durante la interpretación',
    levels: [
      { value: 1, label: 'Básico', description: 'Frecuentemente desafinado' },
      { value: 2, label: 'Aceptable', description: 'Afinado la mayor parte del tiempo, pero con algunas notas fuera de tono' },
      { value: 3, label: 'Bueno', description: 'Mayormente afinado, con ligeras desviaciones' },
      { value: 4, label: 'Excelente', description: 'Siempre afinado' }
    ]
  },
  rangoVocal: {
    name: 'Rango Vocal',
    description: 'Amplitud de notas que puede cantar cómodamente',
    levels: [
      { value: 1, label: 'Básico', description: 'Rango vocal limitado' },
      { value: 2, label: 'Aceptable', description: 'Rango vocal moderado, adecuado para la mayoría de las canciones' },
      { value: 3, label: 'Bueno', description: 'Buen rango vocal, con algunas limitaciones en los extremos' },
      { value: 4, label: 'Excelente', description: 'Amplio rango vocal, capaz de alcanzar notas altas y bajas con facilidad' }
    ]
  },
  controlVocal: {
    name: 'Control Vocal',
    description: 'Capacidad de controlar el volumen, la respiración y la dinámica',
    levels: [
      { value: 1, label: 'Básico', description: 'Control limitado, con dificultades para mantener el volumen y la respiración' },
      { value: 2, label: 'Aceptable', description: 'Control adecuado, pero con limitaciones en dinámicas complejas' },
      { value: 3, label: 'Bueno', description: 'Buen control, con algunas áreas de mejora' },
      { value: 4, label: 'Excelente', description: 'Control total sobre la voz, capaz de variar dinámicas y mantener el control' }
    ]
  },
  expresividad: {
    name: 'Expresividad',
    description: 'Capacidad de transmitir emociones a través del canto',
    levels: [
      { value: 1, label: 'Básico', description: 'Expresividad limitada' },
      { value: 2, label: 'Aceptable', description: 'Adecuadamente expresivo, pero con limitaciones en la profundidad emocional' },
      { value: 3, label: 'Bueno', description: 'Expresivo, pero con margen para mejorar en la conexión emocional' },
      { value: 4, label: 'Excelente', description: 'Altamente expresivo, capaz de conectar emocionalmente con la audiencia' }
    ]
  },
  
  // Instrumento
  tecnica: {
    name: 'Técnica',
    description: 'Destreza técnica en el manejo del instrumento',
    levels: [
      { value: 1, label: 'Básico', description: 'Técnica limitada, con dificultades en piezas complejas' },
      { value: 2, label: 'Aceptable', description: 'Técnica adecuada para la mayoría de las piezas' },
      { value: 3, label: 'Bueno', description: 'Buena técnica, con algunas áreas de mejora' },
      { value: 4, label: 'Excelente', description: 'Técnica impecable, capaz de ejecutar piezas complejas con precisión' }
    ]
  },
  precision: {
    name: 'Precisión',
    description: 'Capacidad de tocar las notas correctas en el tiempo adecuado',
    levels: [
      { value: 1, label: 'Básico', description: 'Frecuentemente impreciso' },
      { value: 2, label: 'Aceptable', description: 'Preciso la mayor parte del tiempo, pero con algunos errores' },
      { value: 3, label: 'Bueno', description: 'Mayormente preciso, con ligeros errores ocasionales' },
      { value: 4, label: 'Excelente', description: 'Siempre preciso, sin errores' }
    ]
  },
  creatividad: {
    name: 'Creatividad',
    description: 'Capacidad de improvisar y aportar ideas musicales originales',
    levels: [
      { value: 1, label: 'Básico', description: 'Creatividad limitada' },
      { value: 2, label: 'Aceptable', description: 'Adecuadamente creativo, pero con limitaciones en la improvisación' },
      { value: 3, label: 'Bueno', description: 'Creativo, pero con margen para más innovación' },
      { value: 4, label: 'Excelente', description: 'Altamente creativo, capaz de improvisar y aportar ideas innovadoras' }
    ]
  },
  versatilidad: {
    name: 'Versatilidad',
    description: 'Capacidad de tocar diferentes estilos y géneros musicales',
    levels: [
      { value: 1, label: 'Básico', description: 'Versatilidad limitada' },
      { value: 2, label: 'Aceptable', description: 'Adecuadamente versátil, pero con limitaciones en algunos géneros' },
      { value: 3, label: 'Bueno', description: 'Versátil, pero con preferencia por ciertos estilos' },
      { value: 4, label: 'Excelente', description: 'Altamente versátil, capaz de adaptarse a múltiples estilos' }
    ]
  },
  
  // Compromiso
  asistenciaEnsayos: {
    name: 'Asistencia a Ensayos',
    description: 'Regularidad con la que asiste a los ensayos',
    levels: [
      { value: 1, label: 'Básico', description: 'Asiste ocasionalmente, con muchas ausencias' },
      { value: 2, label: 'Aceptable', description: 'Asiste regularmente, pero con algunas ausencias' },
      { value: 3, label: 'Bueno', description: 'Asiste a la mayoría de los ensayos, con pocas ausencias' },
      { value: 4, label: 'Excelente', description: 'Asiste a todos los ensayos sin falta' }
    ]
  },
  participacionEventos: {
    name: 'Participación en Eventos',
    description: 'Disposición para participar en conciertos y otros eventos',
    levels: [
      { value: 1, label: 'Básico', description: 'Participa ocasionalmente' },
      { value: 2, label: 'Aceptable', description: 'Participa regularmente, pero con algunas excepciones' },
      { value: 3, label: 'Bueno', description: 'Participa en la mayoría de los eventos' },
      { value: 4, label: 'Excelente', description: 'Siempre dispuesto a participar en eventos' }
    ]
  },
  colaboracion: {
    name: 'Colaboración',
    description: 'Disposición para colaborar y trabajar en equipo',
    levels: [
      { value: 1, label: 'Básico', description: 'Colaboración limitada' },
      { value: 2, label: 'Aceptable', description: 'Adecuadamente colaborativo, pero con limitaciones en ciertas situaciones' },
      { value: 3, label: 'Bueno', description: 'Colaborativo, pero con algunas áreas de mejora' },
      { value: 4, label: 'Excelente', description: 'Altamente colaborativo, siempre dispuesto a ayudar' }
    ]
  }
};