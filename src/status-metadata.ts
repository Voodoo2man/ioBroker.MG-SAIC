/** ioBroker metadata for one vehicle status value. */
export interface VehicleStatusMetadata {
	/** State value type. */
	type: 'number' | 'boolean';
	/** Semantic ioBroker state role. */
	role: string;
	/** Localized state name. */
	name: LocalizedStatusName;
	/** Physical unit, when known. */
	unit?: string;
}

type LocalizedStatusName = {
	en: string;
	de: string;
	ru: string;
	pt: string;
	nl: string;
	fr: string;
	it: string;
	es: string;
	pl: string;
	uk: string;
	'zh-cn': string;
};

export type VehicleStatusGroup = 'driving' | 'access' | 'climate' | 'tires' | 'lighting' | 'energy' | 'general';

/**
 * Return the functional channel for a vehicle status field.
 *
 * @param key SAIC vehicle status field name.
 */
export function getVehicleStatusGroup(key: string): VehicleStatusGroup {
	if (['currentJourneyDistance', 'engineStatus', 'handBrake', 'mileage', 'speed'].includes(key)) {
		return 'driving';
	}
	if (/Door|Window|bonnetStatus|bootStatus|lockStatus/.test(key)) {
		return 'access';
	}
	if (/Temperature|Climate|SeatHeat|steeringHeat|steeringWheelHeat/.test(key)) {
		return 'climate';
	}
	if (/Tyre|wheelTyre/.test(key)) {
		return 'tires';
	}
	if (/Beam|Light/.test(key)) {
		return 'lighting';
	}
	if (
		key === 'extendedData1' ||
		/battery|Battery|fuel|Fuel|Range|range|Soc|SOC|Charging|charging|ElecRng|elecRng/i.test(key)
	) {
		return 'energy';
	}
	return 'general';
}

const statusNames: Record<string, LocalizedStatusName> = {
	extendedData1: {
		en: 'Battery state of charge',
		de: 'Batterie-Ladezustand',
		ru: 'Уровень заряда батареи',
		pt: 'Nível de carga da bateria',
		nl: 'Batterijlading',
		fr: 'Niveau de charge de la batterie',
		it: 'Livello di carica della batteria',
		es: 'Nivel de carga de la batería',
		pl: 'Poziom naładowania baterii',
		uk: 'Рівень заряду батареї',
		'zh-cn': '电池电量',
	},
	gpsLatitude: {
		en: 'GPS latitude',
		de: 'GPS-Breitengrad',
		ru: 'Широта GPS',
		pt: 'Latitude GPS',
		nl: 'GPS-breedtegraad',
		fr: 'Latitude GPS',
		it: 'Latitudine GPS',
		es: 'Latitud GPS',
		pl: 'Szerokość geograficzna GPS',
		uk: 'Широта GPS',
		'zh-cn': 'GPS 纬度',
	},
	gpsLongitude: {
		en: 'GPS longitude',
		de: 'GPS-Längengrad',
		ru: 'Долгота GPS',
		pt: 'Longitude GPS',
		nl: 'GPS-lengtegraad',
		fr: 'Longitude GPS',
		it: 'Longitudine GPS',
		es: 'Longitud GPS',
		pl: 'Długość geograficzna GPS',
		uk: 'Довгота GPS',
		'zh-cn': 'GPS 经度',
	},
	batteryVoltage: {
		en: 'Auxiliary battery voltage',
		de: 'Spannung der 12-V-Batterie',
		ru: 'Напряжение вспомогательной батареи',
		pt: 'Tensão da bateria auxiliar',
		nl: 'Spanning van de hulpaccu',
		fr: 'Tension de la batterie auxiliaire',
		it: 'Tensione della batteria ausiliaria',
		es: 'Voltaje de la batería auxiliar',
		pl: 'Napięcie akumulatora pomocniczego',
		uk: 'Напруга допоміжної батареї',
		'zh-cn': '辅助电池电压',
	},
	bonnetStatus: {
		en: 'Bonnet',
		de: 'Motorhaube',
		ru: 'Капот',
		pt: 'Capô',
		nl: 'Motorkap',
		fr: 'Capot',
		it: 'Cofano',
		es: 'Capó',
		pl: 'Maska',
		uk: 'Капот',
		'zh-cn': '引擎盖',
	},
	bootStatus: {
		en: 'Boot',
		de: 'Kofferraum',
		ru: 'Багажник',
		pt: 'Porta-malas',
		nl: 'Kofferbak',
		fr: 'Coffre',
		it: 'Bagagliaio',
		es: 'Maletero',
		pl: 'Bagażnik',
		uk: 'Багажник',
		'zh-cn': '后备箱',
	},
	canBusActive: {
		en: 'CAN bus active',
		de: 'CAN-Bus aktiv',
		ru: 'Шина CAN активна',
		pt: 'Barramento CAN ativo',
		nl: 'CAN-bus actief',
		fr: 'Bus CAN actif',
		it: 'Bus CAN attivo',
		es: 'Bus CAN activo',
		pl: 'Magistrala CAN aktywna',
		uk: 'Шина CAN активна',
		'zh-cn': 'CAN 总线已激活',
	},
	currentJourneyDistance: {
		en: 'Current journey distance',
		de: 'Strecke der aktuellen Fahrt',
		ru: 'Расстояние текущей поездки',
		pt: 'Distância da viagem atual',
		nl: 'Afstand van huidige rit',
		fr: 'Distance du trajet actuel',
		it: 'Distanza del viaggio attuale',
		es: 'Distancia del viaje actual',
		pl: 'Dystans bieżącej podróży',
		uk: 'Відстань поточної поїздки',
		'zh-cn': '当前行驶里程',
	},
	dippedBeamStatus: {
		en: 'Dipped beam',
		de: 'Abblendlicht',
		ru: 'Ближний свет',
		pt: 'Farol baixo',
		nl: 'Dimlicht',
		fr: 'Feux de croisement',
		it: 'Anabbaglianti',
		es: 'Luces de cruce',
		pl: 'Światła mijania',
		uk: 'Ближнє світло',
		'zh-cn': '近光灯',
	},
	driverDoor: {
		en: 'Door driver',
		de: 'Fahrertür',
		ru: 'Дверь водителя',
		pt: 'Porta do motorista',
		nl: 'Bestuurdersdeur',
		fr: 'Porte conducteur',
		it: 'Porta del conducente',
		es: 'Puerta del conductor',
		pl: 'Drzwi kierowcy',
		uk: 'Двері водія',
		'zh-cn': '驾驶员车门',
	},
	driverWindow: {
		en: 'Window driver',
		de: 'Fahrerfenster',
		ru: 'Окно водителя',
		pt: 'Janela do motorista',
		nl: 'Bestuurdersraam',
		fr: 'Vitre conducteur',
		it: 'Finestrino del conducente',
		es: 'Ventana del conductor',
		pl: 'Szyba kierowcy',
		uk: 'Вікно водія',
		'zh-cn': '驾驶员车窗',
	},
	engineStatus: {
		en: 'Engine running',
		de: 'Motor läuft',
		ru: 'Двигатель работает',
		pt: 'Motor ligado',
		nl: 'Motor draait',
		fr: 'Moteur en marche',
		it: 'Motore acceso',
		es: 'Motor en marcha',
		pl: 'Silnik pracuje',
		uk: 'Двигун працює',
		'zh-cn': '发动机运行中',
	},
	exteriorTemperature: {
		en: 'Exterior temperature',
		de: 'Außentemperatur',
		ru: 'Температура снаружи',
		pt: 'Temperatura externa',
		nl: 'Buitentemperatuur',
		fr: 'Température extérieure',
		it: 'Temperatura esterna',
		es: 'Temperatura exterior',
		pl: 'Temperatura zewnętrzna',
		uk: 'Зовнішня температура',
		'zh-cn': '车外温度',
	},
	frontLeftTyrePressure: {
		en: 'Tyre pressure front left',
		de: 'Reifendruck vorne links',
		ru: 'Давление в шине спереди слева',
		pt: 'Pressão do pneu dianteiro esquerdo',
		nl: 'Bandenspanning linksvoor',
		fr: 'Pression du pneu avant gauche',
		it: 'Pressione pneumatico anteriore sinistro',
		es: 'Presión del neumático delantero izquierdo',
		pl: 'Ciśnienie w lewej przedniej oponie',
		uk: 'Тиск у шині спереду ліворуч',
		'zh-cn': '左前轮胎压',
	},
	frontRightTyrePressure: {
		en: 'Tyre pressure front right',
		de: 'Reifendruck vorne rechts',
		ru: 'Давление в шине спереди справа',
		pt: 'Pressão do pneu dianteiro direito',
		nl: 'Bandenspanning rechtsvoor',
		fr: 'Pression du pneu avant droit',
		it: 'Pressione pneumatico anteriore destro',
		es: 'Presión del neumático delantero derecho',
		pl: 'Ciśnienie w prawej przedniej oponie',
		uk: 'Тиск у шині спереду праворуч',
		'zh-cn': '右前轮胎压',
	},
	fuelLevelPrc: {
		en: 'Fossil fuel level',
		de: 'Kraftstoffstand',
		ru: 'Уровень топлива',
		pt: 'Nível de combustível',
		nl: 'Brandstofniveau',
		fr: 'Niveau de carburant',
		it: 'Livello carburante',
		es: 'Nivel de combustible',
		pl: 'Poziom paliwa',
		uk: 'Рівень пального',
		'zh-cn': '燃油液位',
	},
	fuelRange: {
		en: 'Fossil fuel range',
		de: 'Kraftstoffreichweite',
		ru: 'Запас хода на топливе',
		pt: 'Autonomia com combustível',
		nl: 'Actieradius op brandstof',
		fr: 'Autonomie au carburant',
		it: 'Autonomia a carburante',
		es: 'Autonomía con combustible',
		pl: 'Zasięg na paliwie',
		uk: 'Запас ходу на пальному',
		'zh-cn': '燃油续航里程',
	},
	fuelRangeElec: {
		en: 'Electric range',
		de: 'Elektrische Reichweite',
		ru: 'Запас хода на электротяге',
		pt: 'Autonomia elétrica',
		nl: 'Elektrische actieradius',
		fr: 'Autonomie électrique',
		it: 'Autonomia elettrica',
		es: 'Autonomía eléctrica',
		pl: 'Zasięg elektryczny',
		uk: 'Запас ходу на електротязі',
		'zh-cn': '纯电续航里程',
	},
	handBrake: {
		en: 'Handbrake',
		de: 'Handbremse',
		ru: 'Стояночный тормоз',
		pt: 'Freio de mão',
		nl: 'Handrem',
		fr: 'Frein à main',
		it: 'Freno a mano',
		es: 'Freno de mano',
		pl: 'Hamulec ręczny',
		uk: 'Стоянкове гальмо',
		'zh-cn': '手刹',
	},
	interiorTemperature: {
		en: 'Interior temperature',
		de: 'Innenraumtemperatur',
		ru: 'Температура в салоне',
		pt: 'Temperatura interna',
		nl: 'Binnentemperatuur',
		fr: 'Température intérieure',
		it: 'Temperatura interna',
		es: 'Temperatura interior',
		pl: 'Temperatura wewnątrz',
		uk: 'Температура в салоні',
		'zh-cn': '车内温度',
	},
	lockStatus: {
		en: 'Doors locked',
		de: 'Türen verriegelt',
		ru: 'Двери заперты',
		pt: 'Portas trancadas',
		nl: 'Deuren vergrendeld',
		fr: 'Portes verrouillées',
		it: 'Porte bloccate',
		es: 'Puertas bloqueadas',
		pl: 'Drzwi zablokowane',
		uk: 'Двері замкнені',
		'zh-cn': '车门已锁',
	},
	mileage: {
		en: 'Mileage',
		de: 'Kilometerstand',
		ru: 'Пробег',
		pt: 'Quilometragem',
		nl: 'Kilometerstand',
		fr: 'Kilométrage',
		it: 'Chilometraggio',
		es: 'Kilometraje',
		pl: 'Przebieg',
		uk: 'Пробіг',
		'zh-cn': '里程',
	},
	onlineStatus: {
		en: 'Online status',
		de: 'Online-Status',
		ru: 'Сетевой статус',
		pt: 'Status online',
		nl: 'Onlinestatus',
		fr: 'Statut en ligne',
		it: 'Stato online',
		es: 'Estado en línea',
		pl: 'Status online',
		uk: 'Мережевий статус',
		'zh-cn': '在线状态',
	},
	passengerDoor: {
		en: 'Door passenger',
		de: 'Beifahrertür',
		ru: 'Дверь пассажира',
		pt: 'Porta do passageiro',
		nl: 'Passagiersdeur',
		fr: 'Porte passager',
		it: 'Porta del passeggero',
		es: 'Puerta del pasajero',
		pl: 'Drzwi pasażera',
		uk: 'Двері пасажира',
		'zh-cn': '乘客车门',
	},
	passengerWindow: {
		en: 'Window passenger',
		de: 'Beifahrerfenster',
		ru: 'Окно пассажира',
		pt: 'Janela do passageiro',
		nl: 'Passagiersraam',
		fr: 'Vitre passager',
		it: 'Finestrino del passeggero',
		es: 'Ventana del pasajero',
		pl: 'Szyba pasażera',
		uk: 'Вікно пасажира',
		'zh-cn': '乘客车窗',
	},
	rearLeftDoor: {
		en: 'Door rear left',
		de: 'Hintere Tür links',
		ru: 'Задняя левая дверь',
		pt: 'Porta traseira esquerda',
		nl: 'Linker achterportier',
		fr: 'Porte arrière gauche',
		it: 'Porta posteriore sinistra',
		es: 'Puerta trasera izquierda',
		pl: 'Lewe tylne drzwi',
		uk: 'Задні ліві двері',
		'zh-cn': '左后车门',
	},
	rearLeftTyrePressure: {
		en: 'Tyre pressure rear left',
		de: 'Reifendruck hinten links',
		ru: 'Давление в шине сзади слева',
		pt: 'Pressão do pneu traseiro esquerdo',
		nl: 'Bandenspanning linksachter',
		fr: 'Pression du pneu arrière gauche',
		it: 'Pressione pneumatico posteriore sinistro',
		es: 'Presión del neumático trasero izquierdo',
		pl: 'Ciśnienie w lewej tylnej oponie',
		uk: 'Тиск у шині ззаду ліворуч',
		'zh-cn': '左后轮胎压',
	},
	rearLeftWindow: {
		en: 'Window rear left',
		de: 'Hinteres Fenster links',
		ru: 'Заднее левое окно',
		pt: 'Janela traseira esquerda',
		nl: 'Linker achterraam',
		fr: 'Vitre arrière gauche',
		it: 'Finestrino posteriore sinistro',
		es: 'Ventana trasera izquierda',
		pl: 'Lewa tylna szyba',
		uk: 'Заднє ліве вікно',
		'zh-cn': '左后车窗',
	},
	rearRightDoor: {
		en: 'Door rear right',
		de: 'Hintere Tür rechts',
		ru: 'Задняя правая дверь',
		pt: 'Porta traseira direita',
		nl: 'Rechter achterportier',
		fr: 'Porte arrière droite',
		it: 'Porta posteriore destra',
		es: 'Puerta trasera derecha',
		pl: 'Prawe tylne drzwi',
		uk: 'Задні праві двері',
		'zh-cn': '右后车门',
	},
	rearRightTyrePressure: {
		en: 'Tyre pressure rear right',
		de: 'Reifendruck hinten rechts',
		ru: 'Давление в шине сзади справа',
		pt: 'Pressão do pneu traseiro direito',
		nl: 'Bandenspanning rechtsachter',
		fr: 'Pression du pneu arrière droit',
		it: 'Pressione pneumatico posteriore destro',
		es: 'Presión del neumático trasero derecho',
		pl: 'Ciśnienie w prawej tylnej oponie',
		uk: 'Тиск у шині ззаду праворуч',
		'zh-cn': '右后轮胎压',
	},
	rearRightWindow: {
		en: 'Window rear right',
		de: 'Hinteres Fenster rechts',
		ru: 'Заднее правое окно',
		pt: 'Janela traseira direita',
		nl: 'Rechter achterraam',
		fr: 'Vitre arrière droite',
		it: 'Finestrino posteriore destro',
		es: 'Ventana trasera derecha',
		pl: 'Prawa tylna szyba',
		uk: 'Заднє праве вікно',
		'zh-cn': '右后车窗',
	},
	remoteClimateStatus: {
		en: 'Remote climate state',
		de: 'Klimatisierung per Fernsteuerung',
		ru: 'Состояние дистанционного климат-контроля',
		pt: 'Estado do climatizador remoto',
		nl: 'Status klimaatregeling op afstand',
		fr: 'État de la climatisation à distance',
		it: 'Stato climatizzazione remota',
		es: 'Estado de la climatización remota',
		pl: 'Stan zdalnej klimatyzacji',
		uk: 'Стан дистанційного клімат-контролю',
		'zh-cn': '远程空调状态',
	},
	secondRowLeftSeatHeatLevel: {
		en: 'Heated seat rear left',
		de: 'Sitzheizung hinten links',
		ru: 'Обогрев заднего левого сиденья',
		pt: 'Aquecimento do banco traseiro esquerdo',
		nl: 'Stoelverwarming linksachter',
		fr: 'Siège arrière gauche chauffant',
		it: 'Riscaldamento sedile posteriore sinistro',
		es: 'Calefacción del asiento trasero izquierdo',
		pl: 'Ogrzewanie lewego tylnego siedzenia',
		uk: 'Обігрів заднього лівого сидіння',
		'zh-cn': '左后座椅加热',
	},
	secondRowRightSeatHeatLevel: {
		en: 'Heated seat rear right',
		de: 'Sitzheizung hinten rechts',
		ru: 'Обогрев заднего правого сиденья',
		pt: 'Aquecimento do banco traseiro direito',
		nl: 'Stoelverwarming rechtsachter',
		fr: 'Siège arrière droit chauffant',
		it: 'Riscaldamento sedile posteriore destro',
		es: 'Calefacción del asiento trasero derecho',
		pl: 'Ogrzewanie prawego tylnego siedzenia',
		uk: 'Обігрів заднього правого сидіння',
		'zh-cn': '右后座椅加热',
	},
	sideLightStatus: {
		en: 'Side light',
		de: 'Standlicht',
		ru: 'Габаритные огни',
		pt: 'Luz de posição',
		nl: 'Stadslicht',
		fr: 'Feux de position',
		it: 'Luci di posizione',
		es: 'Luz de posición',
		pl: 'Światła pozycyjne',
		uk: 'Габаритні вогні',
		'zh-cn': '示宽灯',
	},
	steeringHeatLevel: {
		en: 'Steering wheel heating',
		de: 'Lenkradheizung',
		ru: 'Обогрев рулевого колеса',
		pt: 'Aquecimento do volante',
		nl: 'Stuurwielverwarming',
		fr: 'Chauffage du volant',
		it: 'Riscaldamento del volante',
		es: 'Calefacción del volante',
		pl: 'Podgrzewanie kierownicy',
		uk: 'Обігрів керма',
		'zh-cn': '方向盘加热',
	},
	speed: {
		en: 'Speed',
		de: 'Geschwindigkeit',
		ru: 'Скорость',
		pt: 'Velocidade',
		nl: 'Snelheid',
		fr: 'Vitesse',
		it: 'Velocità',
		es: 'Velocidad',
		pl: 'Prędkość',
		uk: 'Швидкість',
		'zh-cn': '车速',
	},
	vehicleAlarmStatus: {
		en: 'Vehicle alarm status',
		de: 'Fahrzeugalarmstatus',
		ru: 'Состояние сигнализации автомобиля',
		pt: 'Estado do alarme do veículo',
		nl: 'Voertuigalarmstatus',
		fr: "État de l'alarme du véhicule",
		it: "Stato dell'allarme del veicolo",
		es: 'Estado de la alarma del vehículo',
		pl: 'Stan alarmu pojazdu',
		uk: 'Стан сигналізації автомобіля',
		'zh-cn': '车辆警报状态',
	},
	wheelTyreMonitorStatus: {
		en: 'Wheel tyre monitor status',
		de: 'Reifendruckkontrollsystem',
		ru: 'Состояние контроля давления в шинах',
		pt: 'Estado do monitor de pneus',
		nl: 'Bandenspanningscontrolesysteem',
		fr: 'État du contrôle de pression des pneus',
		it: 'Stato del monitoraggio pneumatici',
		es: 'Estado del monitor de neumáticos',
		pl: 'Stan monitorowania ciśnienia w oponach',
		uk: 'Стан контролю тиску в шинах',
		'zh-cn': '轮胎监测状态',
	},
	statusTime: {
		en: 'Status time',
		de: 'Zeitstempel des Status',
		ru: 'Время получения статуса',
		pt: 'Horário do status',
		nl: 'Statustijd',
		fr: 'Heure du statut',
		it: 'Orario dello stato',
		es: 'Hora del estado',
		pl: 'Czas statusu',
		uk: 'Час отримання статусу',
		'zh-cn': '状态时间',
	},
	sunroofStatus: {
		en: 'Sun roof',
		de: 'Schiebedach',
		ru: 'Люк',
		pt: 'Teto solar',
		nl: 'Schuifdak',
		fr: 'Toit ouvrant',
		it: 'Tetto apribile',
		es: 'Techo solar',
		pl: 'Szyberdach',
		uk: 'Люк',
		'zh-cn': '天窗',
	},
	vehElecRngDsp: {
		en: 'Electric range display',
		de: 'Anzeige der elektrischen Reichweite',
		ru: 'Отображаемый запас хода на электротяге',
		pt: 'Autonomia elétrica exibida',
		nl: 'Weergave elektrische actieradius',
		fr: 'Autonomie électrique affichée',
		it: 'Autonomia elettrica visualizzata',
		es: 'Autonomía eléctrica mostrada',
		pl: 'Wyświetlany zasięg elektryczny',
		uk: 'Відображуваний запас ходу на електротязі',
		'zh-cn': '显示的电动续航里程',
	},
};

const booleanStatusFields = new Set([
	'bonnetStatus',
	'bootStatus',
	'canBusActive',
	'dippedBeamStatus',
	'driverDoor',
	'driverWindow',
	'engineStatus',
	'handBrake',
	'lockStatus',
	'onlineStatus',
	'passengerDoor',
	'passengerWindow',
	'rearLeftDoor',
	'rearLeftWindow',
	'rearRightDoor',
	'rearRightWindow',
	'sideLightStatus',
	'sunroofStatus',
]);

const statusUnits: Record<string, string> = {
	batteryVoltage: 'V',
	currentJourneyDistance: 'km',
	exteriorTemperature: '°C',
	extendedData1: '%',
	gpsAltitude: 'm',
	gpsLatitude: '°',
	gpsLongitude: '°',
	frontLeftTyrePressure: 'bar',
	frontRightTyrePressure: 'bar',
	fuelLevelPrc: '%',
	fuelRange: 'km',
	fuelRangeElec: 'km',
	interiorTemperature: '°C',
	mileage: 'km',
	rearLeftTyrePressure: 'bar',
	rearRightTyrePressure: 'bar',
	vehElecRngDsp: 'km',
	speed: 'km/h',
};

const statusScales: Record<string, { factor: number; precision: number }> = {
	batteryVoltage: { factor: 0.1, precision: 1 },
	currentJourneyDistance: { factor: 0.1, precision: 1 },
	fuelRange: { factor: 0.1, precision: 1 },
	fuelRangeElec: { factor: 0.1, precision: 1 },
	frontLeftTyrePressure: { factor: 0.04, precision: 2 },
	frontRightTyrePressure: { factor: 0.04, precision: 2 },
	mileage: { factor: 0.1, precision: 1 },
	rearLeftTyrePressure: { factor: 0.04, precision: 2 },
	rearRightTyrePressure: { factor: 0.04, precision: 2 },
	speed: { factor: 0.1, precision: 1 },
};

/**
 * Returns the ioBroker metadata for a vehicle status field.
 *
 * @param key SAIC status field name.
 */
export function getVehicleStatusMetadata(key: string): VehicleStatusMetadata {
	const name =
		statusNames[key] ??
		(Object.fromEntries(
			(['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'] as const).map(language => [
				language,
				key,
			]),
		) as LocalizedStatusName);
	if (key === 'statusTime') {
		return { type: 'number', role: 'date', name };
	}
	if (booleanStatusFields.has(key)) {
		return { type: 'boolean', role: 'indicator', name };
	}
	return {
		type: 'number',
		role: 'value',
		name,
		...(statusUnits[key] ? { unit: statusUnits[key] } : {}),
	};
}

/**
 * Converts binary numeric codes to booleans for known indicator fields.
 *
 * @param key SAIC status field name.
 * @param value Numeric value returned by the API.
 */
export function normalizeVehicleStatusValue(key: string, value: number): number | boolean {
	if (key === 'statusTime') {
		return value * 1000;
	}
	if (booleanStatusFields.has(key) && (value === 0 || value === 1)) {
		return value === 1;
	}
	const scale = statusScales[key];
	return scale ? Number((value * scale.factor).toFixed(scale.precision)) : value;
}
