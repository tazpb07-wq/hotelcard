import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAllComments, Comment, CommentFormData } from "@/hooks/useComments";
import { useProperties } from "@/hooks/useProperties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Star,
  MessageSquare,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

const AdminComentarios = () => {
  const { comments, loading, createComment, updateComment, deleteComment, uploadPhoto, refetch } = useAllComments();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  
  const [activeTab, setActiveTab] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<(Comment & { property_title?: string }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<CommentFormData>({
    property_id: "",
    client_name: "",
    client_photo_url: null,
    comment_text: "",
    rating: null,
    is_visible: true,
  });

  // Set first property as active tab when properties load
  useMemo(() => {
    if (properties && properties.length > 0 && !activeTab) {
      setActiveTab(properties[0].id);
    }
  }, [properties, activeTab]);

  // Group comments by property
  const commentsByProperty = useMemo(() => {
    const grouped: Record<string, (Comment & { property_title?: string })[]> = {};
    
    properties?.forEach(property => {
      grouped[property.id] = comments.filter(c => c.property_id === property.id);
    });
    
    return grouped;
  }, [comments, properties]);

  // Get comment count for each property
  const getCommentCount = (propertyId: string) => {
    return commentsByProperty[propertyId]?.length || 0;
  };

  const resetForm = () => {
    setFormData({
      property_id: activeTab || "",
      client_name: "",
      client_photo_url: null,
      comment_text: "",
      rating: null,
      is_visible: true,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedComment(null);
  };

  const handleOpenDialog = (comment?: Comment & { property_title?: string }) => {
    if (comment) {
      setSelectedComment(comment);
      setFormData({
        property_id: comment.property_id,
        client_name: comment.client_name,
        client_photo_url: comment.client_photo_url,
        comment_text: comment.comment_text,
        rating: comment.rating,
        is_visible: comment.is_visible,
      });
      setPhotoPreview(comment.client_photo_url);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData(prev => ({ ...prev, client_photo_url: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!formData.property_id || !formData.client_name.trim() || !formData.comment_text.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsSubmitting(true);

    try {
      let photoUrl = formData.client_photo_url;

      // Upload new photo if selected
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const dataToSave = {
        ...formData,
        client_photo_url: photoUrl,
      };

      let success: boolean;
      if (selectedComment) {
        success = await updateComment(selectedComment.id, dataToSave);
      } else {
        success = await createComment(dataToSave);
      }

      if (success) {
        setIsDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error saving comment:", error);
      toast.error("Erro ao salvar comentário");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedComment) return;

    setIsSubmitting(true);
    const success = await deleteComment(selectedComment.id);
    setIsSubmitting(false);

    if (success) {
      setIsDeleteDialogOpen(false);
      setSelectedComment(null);
    }
  };

  const handleToggleVisibility = async (comment: Comment) => {
    await updateComment(comment.id, { is_visible: !comment.is_visible });
  };

  const renderCommentsList = (propertyId: string) => {
    const propertyComments = commentsByProperty[propertyId] || [];

    if (propertyComments.length === 0) {
      return (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/60 shadow-soft">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum comentário para este imóvel.</p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Comentário
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {propertyComments.map((comment) => (
          <div
            key={comment.id}
            className={`bg-card rounded-2xl p-6 shadow-soft border border-border/60 ${!comment.is_visible ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-4">
              <Avatar className="w-14 h-14 flex-shrink-0">
                <AvatarImage src={comment.client_photo_url || undefined} alt={comment.client_name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                  {comment.client_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">{comment.client_name}</span>
                  {comment.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= comment.rating!
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {!comment.is_visible && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      Oculto
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <span>
                    {new Date(comment.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                
                <p className="text-foreground">{comment.comment_text}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleVisibility(comment)}
                  title={comment.is_visible ? "Ocultar" : "Mostrar"}
                >
                  {comment.is_visible ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(comment)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setSelectedComment(comment);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const isLoading = loading || propertiesLoading;

  return (
    <Layout>
      <div className="bg-secondary flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="icon" className="rounded-xl bg-card shadow-sm" asChild>
              <Link to="/admin">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <span className="eyebrow">Admin</span>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                Gerenciar Comentários
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Adicione, edite ou remova avaliações dos imóveis
              </p>
            </div>
            <Button onClick={() => handleOpenDialog()} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Novo Comentário
            </Button>
          </div>

          {/* Tabs by Property */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !properties || properties.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/60 shadow-soft">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum imóvel cadastrado.</p>
              <Button className="mt-4" asChild>
                <Link to="/admin/imoveis">Cadastrar Imóvel</Link>
              </Button>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full h-auto flex-wrap justify-start gap-2 bg-transparent p-0 mb-6">
                {properties.map((property) => (
                  <TabsTrigger
                    key={property.id}
                    value={property.id}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-full bg-card border border-border text-xs font-semibold"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    {property.title}
                    <span className="ml-2 bg-muted data-[state=active]:bg-primary-foreground/20 px-2 py-0.5 rounded-full text-xs">
                      {getCommentCount(property.id)}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {properties.map((property) => (
                <TabsContent key={property.id} value={property.id} className="mt-0">
                  {renderCommentsList(property.id)}
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* Create/Edit Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {selectedComment ? "Editar Comentário" : "Novo Comentário"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Property Select */}
                <div className="space-y-2">
                  <Label>Imóvel</Label>
                  <Select
                    value={formData.property_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o imóvel" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties?.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Name */}
                <div className="space-y-2">
                  <Label htmlFor="client_name">Nome do Cliente</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="Nome do cliente"
                  />
                </div>

                {/* Client Photo */}
                <div className="space-y-2">
                  <Label>Foto do Cliente (opcional)</Label>
                  <div className="flex items-center gap-4">
                    {photoPreview ? (
                      <div className="relative">
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={photoPreview} />
                          <AvatarFallback>
                            {formData.client_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={removePhoto}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    {!photoPreview && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Escolher Foto
                      </Button>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <Label>Avaliação (opcional)</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          rating: prev.rating === star ? null : star 
                        }))}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            formData.rating && star <= formData.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                    {formData.rating && (
                      <span className="text-sm text-muted-foreground ml-2">
                        {formData.rating} estrela{formData.rating > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment Text */}
                <div className="space-y-2">
                  <Label htmlFor="comment_text">Comentário</Label>
                  <Textarea
                    id="comment_text"
                    value={formData.comment_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, comment_text: e.target.value }))}
                    placeholder="Escreva o comentário do cliente..."
                    rows={4}
                  />
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Visível no site</Label>
                    <p className="text-sm text-muted-foreground">
                      O comentário aparecerá na página do imóvel
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_visible}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {selectedComment ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Comentário</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Layout>
  );
};

export default AdminComentarios;
