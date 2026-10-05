import { useComments } from "@/hooks/useComments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Loader2 } from "lucide-react";

interface PropertyCommentsProps {
  propertyId: string;
}

export const PropertyComments = ({ propertyId }: PropertyCommentsProps) => {
  const { comments, loading } = useComments(propertyId);

  // Only show visible comments
  const visibleComments = comments.filter(c => c.is_visible);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (visibleComments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Ainda não há avaliações para este imóvel.</p>
      </div>
    );
  }

  const averageRating = visibleComments.reduce((acc, c) => acc + (c.rating || 0), 0) / visibleComments.filter(c => c.rating).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {visibleComments.some(c => c.rating) && (
        <div className="flex items-center gap-2.5 pb-4 border-b border-border">
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(averageRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
          <span className="text-base font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            ({visibleComments.length} {visibleComments.length === 1 ? "avaliação" : "avaliações"})
          </span>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {visibleComments.map((comment) => (
          <div key={comment.id} className="flex gap-4">
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarImage src={comment.client_photo_url || undefined} alt={comment.client_name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {comment.client_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{comment.client_name}</span>
                {comment.rating && (
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= comment.rating!
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {new Date(comment.created_at).toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-foreground leading-relaxed">{comment.comment_text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
