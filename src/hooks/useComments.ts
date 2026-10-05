import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Comment {
  id: string;
  property_id: string;
  client_name: string;
  client_photo_url: string | null;
  comment_text: string;
  rating: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentFormData {
  property_id: string;
  client_name: string;
  client_photo_url?: string | null;
  comment_text: string;
  rating?: number | null;
  is_visible?: boolean;
}

export const useComments = (propertyId?: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    try {
      let query = supabase
        .from("comments")
        .select("*")
        .order("created_at", { ascending: false });

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [propertyId]);

  const createComment = async (data: CommentFormData): Promise<boolean> => {
    try {
      const { error } = await supabase.from("comments").insert({
        property_id: data.property_id,
        client_name: data.client_name,
        client_photo_url: data.client_photo_url || null,
        comment_text: data.comment_text,
        rating: data.rating || null,
        is_visible: data.is_visible ?? true,
      });

      if (error) throw error;

      toast.success("Comentário criado com sucesso!");
      await fetchComments();
      return true;
    } catch (error) {
      console.error("Error creating comment:", error);
      toast.error("Erro ao criar comentário");
      return false;
    }
  };

  const updateComment = async (id: string, data: Partial<CommentFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("comments")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Comentário atualizado com sucesso!");
      await fetchComments();
      return true;
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Erro ao atualizar comentário");
      return false;
    }
  };

  const deleteComment = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("comments").delete().eq("id", id);

      if (error) throw error;

      toast.success("Comentário excluído com sucesso!");
      await fetchComments();
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Erro ao excluir comentário");
      return false;
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("client-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("client-photos").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao fazer upload da foto");
      return null;
    }
  };

  return {
    comments,
    loading,
    createComment,
    updateComment,
    deleteComment,
    uploadPhoto,
    refetch: fetchComments,
  };
};

export const useAllComments = () => {
  const [comments, setComments] = useState<(Comment & { property_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      // Fetch property titles
      const propertyIds = [...new Set(commentsData?.map(c => c.property_id) || [])];
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id, title")
        .in("id", propertyIds);

      const propertyMap = new Map(propertiesData?.map(p => [p.id, p.title]) || []);

      const commentsWithTitles = commentsData?.map(comment => ({
        ...comment,
        property_title: propertyMap.get(comment.property_id) || "Imóvel não encontrado",
      })) || [];

      setComments(commentsWithTitles);
    } catch (error) {
      console.error("Error fetching all comments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllComments();
  }, []);

  const createComment = async (data: CommentFormData): Promise<boolean> => {
    try {
      const { error } = await supabase.from("comments").insert({
        property_id: data.property_id,
        client_name: data.client_name,
        client_photo_url: data.client_photo_url || null,
        comment_text: data.comment_text,
        rating: data.rating || null,
        is_visible: data.is_visible ?? true,
      });

      if (error) throw error;

      toast.success("Comentário criado com sucesso!");
      await fetchAllComments();
      return true;
    } catch (error) {
      console.error("Error creating comment:", error);
      toast.error("Erro ao criar comentário");
      return false;
    }
  };

  const updateComment = async (id: string, data: Partial<CommentFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("comments")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Comentário atualizado com sucesso!");
      await fetchAllComments();
      return true;
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Erro ao atualizar comentário");
      return false;
    }
  };

  const deleteComment = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("comments").delete().eq("id", id);

      if (error) throw error;

      toast.success("Comentário excluído com sucesso!");
      await fetchAllComments();
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Erro ao excluir comentário");
      return false;
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("client-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("client-photos").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao fazer upload da foto");
      return null;
    }
  };

  return {
    comments,
    loading,
    createComment,
    updateComment,
    deleteComment,
    uploadPhoto,
    refetch: fetchAllComments,
  };
};
