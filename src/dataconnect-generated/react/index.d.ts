import { CreateUserData, ListServicesData, GetEmployeeAvailabilityData, CreateAppointmentData, CreateAppointmentVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, void>): UseDataConnectMutationResult<CreateUserData, undefined>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, void>): UseDataConnectMutationResult<CreateUserData, undefined>;

export function useListServices(options?: useDataConnectQueryOptions<ListServicesData>): UseDataConnectQueryResult<ListServicesData, undefined>;
export function useListServices(dc: DataConnect, options?: useDataConnectQueryOptions<ListServicesData>): UseDataConnectQueryResult<ListServicesData, undefined>;

export function useGetEmployeeAvailability(options?: useDataConnectQueryOptions<GetEmployeeAvailabilityData>): UseDataConnectQueryResult<GetEmployeeAvailabilityData, undefined>;
export function useGetEmployeeAvailability(dc: DataConnect, options?: useDataConnectQueryOptions<GetEmployeeAvailabilityData>): UseDataConnectQueryResult<GetEmployeeAvailabilityData, undefined>;

export function useCreateAppointment(options?: useDataConnectMutationOptions<CreateAppointmentData, FirebaseError, CreateAppointmentVariables>): UseDataConnectMutationResult<CreateAppointmentData, CreateAppointmentVariables>;
export function useCreateAppointment(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAppointmentData, FirebaseError, CreateAppointmentVariables>): UseDataConnectMutationResult<CreateAppointmentData, CreateAppointmentVariables>;
