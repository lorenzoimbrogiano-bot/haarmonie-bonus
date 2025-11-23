import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Appointment_Key {
  id: UUIDString;
  __typename?: 'Appointment_Key';
}

export interface CreateAppointmentData {
  appointment_insert: Appointment_Key;
}

export interface CreateAppointmentVariables {
  serviceId: UUIDString;
  appointmentTime: TimestampString;
  durationMinutes: number;
  notes?: string | null;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface EmployeeAvailability_Key {
  id: UUIDString;
  __typename?: 'EmployeeAvailability_Key';
}

export interface GetEmployeeAvailabilityData {
  employeeAvailabilities: ({
    id: UUIDString;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  } & EmployeeAvailability_Key)[];
}

export interface ListServicesData {
  services: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    durationMinutes: number;
    price: number;
  } & Service_Key)[];
}

export interface Service_Key {
  id: UUIDString;
  __typename?: 'Service_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(): MutationPromise<CreateUserData, undefined>;
export function createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface ListServicesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListServicesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListServicesData, undefined>;
  operationName: string;
}
export const listServicesRef: ListServicesRef;

export function listServices(): QueryPromise<ListServicesData, undefined>;
export function listServices(dc: DataConnect): QueryPromise<ListServicesData, undefined>;

interface GetEmployeeAvailabilityRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetEmployeeAvailabilityData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetEmployeeAvailabilityData, undefined>;
  operationName: string;
}
export const getEmployeeAvailabilityRef: GetEmployeeAvailabilityRef;

export function getEmployeeAvailability(): QueryPromise<GetEmployeeAvailabilityData, undefined>;
export function getEmployeeAvailability(dc: DataConnect): QueryPromise<GetEmployeeAvailabilityData, undefined>;

interface CreateAppointmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAppointmentVariables): MutationRef<CreateAppointmentData, CreateAppointmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAppointmentVariables): MutationRef<CreateAppointmentData, CreateAppointmentVariables>;
  operationName: string;
}
export const createAppointmentRef: CreateAppointmentRef;

export function createAppointment(vars: CreateAppointmentVariables): MutationPromise<CreateAppointmentData, CreateAppointmentVariables>;
export function createAppointment(dc: DataConnect, vars: CreateAppointmentVariables): MutationPromise<CreateAppointmentData, CreateAppointmentVariables>;

