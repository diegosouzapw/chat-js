import type { AppModelId } from "@/lib/ai/app-model-id";
import { toast } from "sonner";

export function switchToCompatibleModel<TModel>({
  capability,
  getModelById,
  modelId,
  onModelChange,
}: {
  capability: string;
  getModelById: (modelId: AppModelId) => TModel | undefined;
  modelId: AppModelId;
  onModelChange: (modelId: AppModelId) => void;
}): TModel | undefined {
  const targetModel = getModelById(modelId);
  if (
    targetModel &&
    typeof targetModel === "object" &&
    "name" in targetModel &&
    typeof targetModel.name === "string"
  ) {
    toast.success(`Switched to ${targetModel.name} (${capability})`);
  }
  onModelChange(modelId);
  return targetModel;
}
