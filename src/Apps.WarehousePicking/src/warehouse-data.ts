import type { IOperationResult } from "@microsoft/power-apps/data"
import {
  Lab_warehouseitemsService,
  Lab_warehouselocationsService,
  Lab_warehousetransactionsService,
} from "@/generated"

export const itemCategories = [
  { value: "100000000", label: "Electronics" },
  { value: "100000001", label: "Clothing" },
  { value: "100000002", label: "Food" },
  { value: "100000003", label: "Hardware" },
  { value: "100000004", label: "Other" },
]

export function unwrapResult<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    throw new Error(result.error?.message ?? "The operation could not be completed.")
  }
  return result.data
}

export function categoryLabel(value?: string | number, formatted?: string) {
  if (formatted) return formatted
  return itemCategories.find((category) => category.value === String(value))?.label ?? "Uncategorized"
}

export function formatQuantity(value?: string | number) {
  const quantity = Number(value ?? 0)
  return Number.isFinite(quantity) ? quantity.toLocaleString() : "0"
}

export const inventoryQueryKey = ["items"]
export const transactionQueryKey = ["transactions"]
export const locationQueryKey = ["locations"]

export const loadItems = async () => unwrapResult(await Lab_warehouseitemsService.getAll({ orderBy: ["lab_name asc"] })) ?? []
export const loadLocations = async () => unwrapResult(await Lab_warehouselocationsService.getAll({ orderBy: ["lab_name asc"] })) ?? []
export const loadTransactions = async () => unwrapResult(await Lab_warehousetransactionsService.getAll({ orderBy: ["lab_transactiondate desc"] })) ?? []