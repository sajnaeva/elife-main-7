import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BlockedWord {
  id: string;
  word: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminBlockedWords() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [bulkWords, setBulkWords] = useState('');
  const [selectedWord, setSelectedWord] = useState<BlockedWord | null>(null);
  const [editWord, setEditWord] = useState('');

  const sessionToken = useMemo(() => localStorage.getItem('admin_session_token'), []);

  const { data: blockedWords, isLoading } = useQuery({
    queryKey: ['blocked-words', sessionToken],
    queryFn: async () => {
      if (!sessionToken) {
        throw new Error('No session token');
      }
      const { data, error } = await supabase.functions.invoke('manage-blocked-words', {
        body: { action: 'list', session_token: sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.data as BlockedWord[];
    },
    enabled: !!sessionToken,
  });

  const addWordMutation = useMutation({
    mutationFn: async (words: string[]) => {
      const { data, error } = await supabase.functions.invoke('manage-blocked-words', {
        body: { action: 'add', session_token: sessionToken, words },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-words'] });
      toast.success('Blocked word(s) added successfully');
      setNewWord('');
      setBulkWords('');
      setAddDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('already exist')) {
        toast.error('One or more words already exist');
      } else {
        toast.error('Failed to add blocked word(s)');
      }
    },
  });

  const updateWordMutation = useMutation({
    mutationFn: async ({ id, word, is_active }: { id: string; word?: string; is_active?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('manage-blocked-words', {
        body: { action: 'update', session_token: sessionToken, id, word, is_active },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-words'] });
      toast.success('Blocked word updated');
      setEditDialogOpen(false);
      setSelectedWord(null);
    },
    onError: () => {
      toast.error('Failed to update blocked word');
    },
  });

  const deleteWordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('manage-blocked-words', {
        body: { action: 'delete', session_token: sessionToken, id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-words'] });
      toast.success('Blocked word deleted');
      setDeleteDialogOpen(false);
      setSelectedWord(null);
    },
    onError: () => {
      toast.error('Failed to delete blocked word');
    },
  });

  const handleAddWord = () => {
    if (bulkWords.trim()) {
      const words = bulkWords
        .split('\n')
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      if (words.length > 0) {
        addWordMutation.mutate(words);
      }
    } else if (newWord.trim()) {
      addWordMutation.mutate([newWord]);
    }
  };

  const handleEditWord = () => {
    if (selectedWord && editWord.trim()) {
      updateWordMutation.mutate({ id: selectedWord.id, word: editWord });
    }
  };

  const handleToggleActive = (word: BlockedWord) => {
    updateWordMutation.mutate({ id: word.id, is_active: !word.is_active });
  };

  const columns = [
    {
      key: 'word' as keyof BlockedWord,
      header: 'Word',
      render: (word: BlockedWord) => (
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <span className="font-medium">{word.word}</span>
        </div>
      ),
    },
    {
      key: 'is_active' as keyof BlockedWord,
      header: 'Status',
      render: (word: BlockedWord) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={word.is_active}
            onCheckedChange={() => handleToggleActive(word)}
          />
          <Badge variant={word.is_active ? 'default' : 'secondary'}>
            {word.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'created_at' as keyof BlockedWord,
      header: 'Added',
      render: (word: BlockedWord) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(word.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'id' as keyof BlockedWord,
      header: 'Actions',
      render: (word: BlockedWord) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedWord(word);
              setEditWord(word.word);
              setEditDialogOpen(true);
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setSelectedWord(word);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Word Monitoring"
      description="Manage blocked words for content moderation"
    >
      <div className="mb-6">
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Blocked Word
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Blocked Words</DialogTitle>
              <DialogDescription>
                Add words that should be blocked in posts, comments, and messages.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Single Word
                </label>
                <Input
                  placeholder="Enter a word to block..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                — OR —
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Bulk Add (one per line)
                </label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="word1&#10;word2&#10;word3"
                  value={bulkWords}
                  onChange={(e) => setBulkWords(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddWord}
                disabled={addWordMutation.isPending || (!newWord.trim() && !bulkWords.trim())}
              >
                {addWordMutation.isPending ? 'Adding...' : 'Add Word(s)'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={blockedWords || []}
        searchKey="word"
        searchPlaceholder="Search blocked words..."
        isLoading={isLoading}
        pageSize={15}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Blocked Word</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter word..."
              value={editWord}
              onChange={(e) => setEditWord(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditWord}
              disabled={updateWordMutation.isPending || !editWord.trim()}
            >
              {updateWordMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blocked Word</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedWord?.word}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedWord && deleteWordMutation.mutate(selectedWord.id)}
            >
              {deleteWordMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
