import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  MapPin,
  DollarSign,
  Save,
  X,
  Image,
  Users,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SortableImageGallery, PropertyImage } from "@/components/admin/SortableImageGallery";
import { SeasonalRatesManager } from "@/components/admin/SeasonalRatesManager";

interface DbProperty {
  id: string;
  title: string;
  type: "flat" | "apartamento";
  description: string | null;
  address: string | null;
  city: string;
  neighborhood: string | null;
  price_per_night: number;
  max_guests: number;
  amenities: string[];
  images: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


const AdminImoveis = () => {
  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProperty, setEditingProperty] = useState<DbProperty | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [propertyImages, setPropertyImages] = useState<PropertyImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  // Seasonal rates dialog
  const [seasonalRatesDialogOpen, setSeasonalRatesDialogOpen] = useState(false);
  const [selectedPropertyForRates, setSelectedPropertyForRates] = useState<DbProperty | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    type: "flat" as "flat" | "apartamento",
    description: "",
    address: "",
    city: "João Pessoa",
    neighborhood: "",
    price_per_night: 0,
    max_guests: 2,
    is_active: true,
    amenities: "",
  });

  // Sort properties: flats first, then apartamentos
  const sortByType = (properties: DbProperty[]): DbProperty[] => {
    return [...properties].sort((a, b) => {
      if (a.type === "flat" && b.type !== "flat") return -1;
      if (a.type !== "flat" && b.type === "flat") return 1;
      return 0;
    });
  };

  // Fetch properties from database
  const fetchProperties = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("type", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedData = (data || []).map((p) => ({
        ...p,
        amenities: Array.isArray(p.amenities) ? p.amenities : [],
        images: Array.isArray(p.images) ? p.images : [],
      })) as DbProperty[];

      // Sort: flats first, then apartamentos
      setProperties(sortByType(transformedData));
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error("Erro ao carregar imóveis");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin-properties-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          fetchProperties();
          queryClient.invalidateQueries({ queryKey: ["properties"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const resetForm = () => {
    setFormData({
      title: "",
      type: "flat",
      description: "",
      address: "",
      city: "João Pessoa",
      neighborhood: "",
      price_per_night: 0,
      max_guests: 2,
      is_active: true,
      amenities: "",
    });
    setPropertyImages([]);
    setEditingProperty(null);
  };

  const handleEdit = (property: DbProperty) => {
    setEditingProperty(property);
    setFormData({
      title: property.title,
      type: property.type,
      description: property.description || "",
      address: property.address || "",
      city: property.city,
      neighborhood: property.neighborhood || "",
      price_per_night: property.price_per_night,
      max_guests: property.max_guests,
      is_active: property.is_active,
      amenities: property.amenities.join(", "),
    });
    // Set up images from property
    const images: PropertyImage[] = property.images.map((url, index) => ({
      id: `img-${index}`,
      url,
      isPrimary: index === 0,
    }));
    setPropertyImages(images);
    setIsDialogOpen(true);
  };

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const newImage: PropertyImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url,
          isPrimary: propertyImages.length === 0,
        };
        setPropertyImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.description || !formData.price_per_night) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setIsSaving(true);

    try {
      // Images are already in correct order (first is primary)
      const imageUrls = propertyImages.map((img) => img.url);

      const propertyData = {
        title: formData.title,
        type: formData.type,
        description: formData.description,
        address: formData.address || null,
        city: formData.city,
        neighborhood: formData.neighborhood || null,
        price_per_night: formData.price_per_night,
        max_guests: formData.max_guests,
        is_active: formData.is_active,
        amenities: formData.amenities.split(",").map((a) => a.trim()).filter(Boolean),
        images: imageUrls.length > 0 ? imageUrls : ["/placeholder.svg"],
      };

      if (editingProperty) {
        const { error } = await supabase
          .from("properties")
          .update(propertyData)
          .eq("id", editingProperty.id);

        if (error) throw error;
        toast.success("Imóvel atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("properties")
          .insert([propertyData]);

        if (error) throw error;
        toast.success("Imóvel adicionado com sucesso!");
      }

      // Invalidate queries to update the public site
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property"] });

      setIsDialogOpen(false);
      resetForm();
      fetchProperties();
    } catch (error) {
      console.error("Error saving property:", error);
      toast.error("Erro ao salvar imóvel");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este imóvel?")) return;

    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Imóvel removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      fetchProperties();
    } catch (error) {
      console.error("Error deleting property:", error);
      toast.error("Erro ao remover imóvel");
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("properties")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success("Disponibilidade atualizada!");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      fetchProperties();
    } catch (error) {
      console.error("Error updating availability:", error);
      toast.error("Erro ao atualizar disponibilidade");
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-secondary flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="rounded-xl bg-card shadow-sm" asChild>
                <Link to="/admin">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <span className="eyebrow">Admin</span>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                  Gerenciar Imóveis
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{properties.length} imóveis cadastrados</p>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="gold">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Imóvel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProperty ? "Editar Imóvel" : "Adicionar Novo Imóvel"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Image Management Section */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Fotos do Imóvel
                    </Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <SortableImageGallery
                      images={propertyImages}
                      onImagesChange={setPropertyImages}
                      onAddImages={handleAddImage}
                    />
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Nome do Imóvel</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="Ex: Flat Aconchego"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Tipo</Label>
                        <select
                          id="type"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.type}
                          onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as "flat" | "apartamento" }))}
                        >
                          <option value="flat">Flat</option>
                          <option value="apartamento">Apartamento</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Descrição detalhada do imóvel"
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price_per_night">Preço/Diária (R$)</Label>
                        <Input
                          id="price_per_night"
                          type="number"
                          value={formData.price_per_night}
                          onChange={(e) => setFormData((prev) => ({ ...prev, price_per_night: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_guests">Máx. Hóspedes</Label>
                        <Input
                          id="max_guests"
                          type="number"
                          min="1"
                          value={formData.max_guests}
                          onChange={(e) => setFormData((prev) => ({ ...prev, max_guests: Number(e.target.value) }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input
                          id="neighborhood"
                          value={formData.neighborhood}
                          onChange={(e) => setFormData((prev) => ({ ...prev, neighborhood: e.target.value }))}
                          placeholder="Ex: Tambaú"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                          placeholder="Ex: João Pessoa"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço Completo</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                        placeholder="Ex: Rua das Flores, 123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amenities">Comodidades (separadas por vírgula)</Label>
                      <Input
                        id="amenities"
                        value={formData.amenities}
                        onChange={(e) => setFormData((prev) => ({ ...prev, amenities: e.target.value }))}
                        placeholder="Wi-Fi, Ar condicionado, TV, Cozinha"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => 
                            setFormData((prev) => ({ ...prev, is_active: checked }))
                          }
                        />
                        <Label htmlFor="is_active">Disponível para reserva</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button type="button" variant="gold" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {isSaving ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Properties Grid */}
          {properties.length === 0 ? (
            <div className="bg-card rounded-2xl p-12 text-center border border-border/60 shadow-soft">
              <Image className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum imóvel cadastrado</h3>
              <p className="text-muted-foreground mb-6">
                Comece adicionando seu primeiro imóvel para exibir no site.
              </p>
              <Button variant="gold" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeiro Imóvel
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {properties.map((property) => (
                <div
                  key={property.id}
                  className="bg-card rounded-2xl overflow-hidden shadow-soft border border-border/60 hover:shadow-card transition-shadow flex flex-col"
                >
                  {/* Image */}
                  <div className="relative aspect-video">
                    <img
                      src={property.images[0] || "/placeholder.svg"}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge variant={property.type === "flat" ? "default" : "secondary"}>
                        {property.type === "flat" ? "Flat" : "Apartamento"}
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge variant={property.is_active ? "default" : "destructive"}>
                        {property.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3 flex flex-col flex-1">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground truncate">{property.title}</h3>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{property.neighborhood}, {property.city}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{property.max_guests} hóspedes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>R$ {Number(property.price_per_night).toLocaleString('pt-BR')}/diária</span>
                      </div>
                    </div>

                    <div className="flex-1" />

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(property)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPropertyForRates(property);
                          setSeasonalRatesDialogOpen(true);
                        }}
                      >
                        <Calendar className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={property.is_active ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleAvailability(property.id, property.is_active)}
                      >
                        {property.is_active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(property.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Seasonal Rates Dialog */}
          <Dialog open={seasonalRatesDialogOpen} onOpenChange={setSeasonalRatesDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tarifas por Período</DialogTitle>
              </DialogHeader>
              {selectedPropertyForRates && (
                <SeasonalRatesManager
                  propertyId={selectedPropertyForRates.id}
                  propertyTitle={selectedPropertyForRates.title}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
};

export default AdminImoveis;
