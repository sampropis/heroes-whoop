// WHOOP API Types

export interface WhoopUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface WhoopActivity {
    id: number;
    score: number;
    kilojoules: number;
    avgHeartRate: number;
    maxHeartRate: number;
    distance: number;
    altitude: number;
    sportId: number;
    start: string;
    end: string;
    zoneData: ActivityZoneData;
}

export interface ActivityZoneData {
    zone0: number;
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
}

export interface WhoopSleep {
    id: number;
    score: number;
    qualityDuration: number;
    latency: number;
    debtPre: number;
    debtPost: number;
    needFromStrain: number;
    start: string;
    end: string;
    cycles: number;
    disturbances: number;
    awakening: number;
    lightSleep: number;
    slowWaveSleep: number;
    remSleep: number;
}

export interface WhoopRecovery {
    id: number;
    score: number;
    restingHeartRate: number;
    heartRateVariability: number;
    skinTemp: number;
    spo2: number;
    timestamp: string;
}

export interface WhoopCycle {
    id: number;
    start: string;
    end: string;
    strain: number;
    averageHeartRate: number;
    maxHeartRate: number;
    kilojoules: number;
    recoveryScore: number;
    sleepScore: number;
}

export interface ApiResponse<T> {
    data: T;
    error?: string;
}
