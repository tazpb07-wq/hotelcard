import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Star, Trash2, GripVertical, Upload, Image } from "lucide-react";
import { toast } from "sonner";

export interface PropertyImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface SortableImageProps {
  image: PropertyImage;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

function SortableImage({ image, onRemove, onSetPrimary }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${
        image.isPrimary
          ? "border-accent ring-2 ring-accent/30"
          : "border-border hover:border-muted-foreground"
      } ${isDragging ? "shadow-xl scale-105" : ""}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-20 p-1.5 rounded bg-foreground/70 text-background cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <img
        src={image.url}
        alt="Foto do imóvel"
        className="w-full h-full object-cover pointer-events-none"
      />

      {image.isPrimary && (
        <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10">
          <Star className="w-3 h-3 fill-current" />
          Principal
        </div>
      )}

      <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {!image.isPrimary && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onSetPrimary(image.id)}
            className="text-xs"
          >
            <Star className="w-3 h-3 mr-1" />
            Principal
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => onRemove(image.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

interface SortableImageGalleryProps {
  images: PropertyImage[];
  onImagesChange: (images: PropertyImage[]) => void;
  onAddImages: () => void;
}

export function SortableImageGallery({
  images,
  onImagesChange,
  onAddImages,
}: SortableImageGalleryProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);

      const newImages = arrayMove(images, oldIndex, newIndex);
      
      // Update primary status based on position
      const updatedImages = newImages.map((img, index) => ({
        ...img,
        isPrimary: index === 0,
      }));

      onImagesChange(updatedImages);
      toast.success("Ordem das fotos atualizada");
    }
  };

  const handleRemove = (imageId: string) => {
    const filtered = images.filter((img) => img.id !== imageId);
    
    // If we removed the primary, make the first one primary
    if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
      filtered[0].isPrimary = true;
    }
    
    onImagesChange(filtered);
    toast.success("Foto removida");
  };

  const handleSetPrimary = (imageId: string) => {
    // Find the image and move it to the first position
    const imageIndex = images.findIndex((img) => img.id === imageId);
    if (imageIndex === -1) return;

    const newImages = arrayMove(images, imageIndex, 0);
    
    // Update primary status
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      isPrimary: index === 0,
    }));

    onImagesChange(updatedImages);
    toast.success("Foto principal definida e movida para o início");
  };

  if (images.length === 0) {
    return (
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground transition-colors"
        onClick={onAddImages}
      >
        <Image className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">
          Clique para adicionar fotos do imóvel
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          A primeira foto será a principal
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {images.map((image) => (
              <SortableImage
                key={image.id}
                image={image}
                onRemove={handleRemove}
                onSetPrimary={handleSetPrimary}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          💡 Arraste as fotos para reorganizar. A primeira foto é a principal (capa).
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onAddImages}>
          <Upload className="w-4 h-4 mr-2" />
          Adicionar Mais
        </Button>
      </div>
    </div>
  );
}
