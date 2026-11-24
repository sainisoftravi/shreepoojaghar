'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api.js';
import { useAuth } from '../../../context/AuthContext.js';
import { fetchHindiTranslation, fetchHindiWithSuggestions, debounceTranslateToHindi } from '../../../lib/translate.js';
import { Tags, Plus, Trash2, Edit2, Layers, Sparkles } from 'lucide-react';

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [userEditedHi, setUserEditedHi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (editingCategory) {
        await apiFetch(`/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify({ nameEn, nameHi }),
        });
      } else {
        await apiFetch('/categories', {
          method: 'POST',
          body: JSON.stringify({ nameEn, nameHi }),
        });
      }

      setShowModal(false);
      resetForm();
      fetchCategories();
    } catch (err) {
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await apiFetch(`/categories/${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (err) {
      alert(err.message || 'Cannot delete category with attached products');
    }
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setNameEn(cat.nameEn);
    setNameHi(cat.nameHi);
    setSuggestions([]);
    setUserEditedHi(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingCategory(null);
    setNameEn('');
    setNameHi('');
    setSuggestions([]);
    setUserEditedHi(false);
  };

  return (
    <>
      <style>{`
        .cat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cat-modal {
          width: 400px;
          border-radius: 20px;
          padding: 2rem;
        }
        @media (max-width: 768px) {
          .cat-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .cat-header button {
            width: 100%;
          }
          .cat-modal {
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
        }
      `}</style>
    <div style={styles.container}>
      <div className="cat-header">
        <div>
          <h1 style={styles.title}>Product Categories</h1>
          <p style={styles.subtitle}>Manage bilingual product categories for Pooja items</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={18} /> Add Category
          </button>
        )}
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {categories.map((c) => (
          <div key={c.id} style={styles.card} className="card animate-fade-in">
            <div style={styles.cardHeader}>
              <div style={styles.iconBox}>
                <Tags size={20} color="#f97316" />
              </div>
              {user?.role === 'ADMIN' && (
                <div style={styles.actions}>
                  <button
                    onClick={() => openEdit(c)}
                    className="btn btn-sm btn-secondary"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="btn btn-sm btn-secondary"
                    title="Delete"
                  >
                    <Trash2 size={14} color="#f43f5e" />
                  </button>
                </div>
              )}
            </div>

            <h3 style={styles.catNameEn}>{c.nameEn}</h3>
            <div style={styles.catNameHi}>{c.nameHi}</div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div className="cat-modal glass-panel animate-fade-in">
            <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
            {error && <div style={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSave} style={styles.modalForm}>
              <div className="input-group">
                <label>English Category Name</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Pooja Samagri or daal cheeni"
                  value={nameEn}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNameEn(val);
                    if (!userEditedHi || !nameHi) {
                      debounceTranslateToHindi(val, (translated, suggs) => {
                        setNameHi(translated);
                        if (suggs) setSuggestions(suggs);
                      });
                    }
                  }}
                  required
                />
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ margin: 0 }}>Hindi Category Name</label>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#ea580c', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                    onClick={async () => {
                      if (!nameEn) return;
                      const res = await fetchHindiWithSuggestions(nameEn);
                      if (res.translated) setNameHi(res.translated);
                      if (res.suggestions) setSuggestions(res.suggestions);
                    }}
                  >
                    <Sparkles size={13} /> Auto-translate
                  </button>
                </div>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. पूजा सामग्री या दालचीनी"
                  value={nameHi}
                  onChange={(e) => {
                    setNameHi(e.target.value);
                    setUserEditedHi(true);
                  }}
                  required
                />
                {suggestions.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Google Typing:</span>
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setNameHi(s);
                          setUserEditedHi(true);
                        }}
                        style={{
                          background: nameHi === s ? '#ffedd5' : '#f8fafc',
                          border: nameHi === s ? '1px solid #ea580c' : '1px solid #cbd5e1',
                          color: nameHi === s ? '#c2410c' : '#334155',
                          fontSize: '0.78rem',
                          padding: '2px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Auto-translates English & Hinglish words (Google typing). You can pick suggestions or edit anytime.
                </small>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#536168',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '130px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.8rem',
  },
  iconBox: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'rgba(249, 115, 22, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    display: 'flex',
    gap: '0.4rem',
  },
  catNameEn: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#1f2a2e',
  },
  catNameHi: {
    fontSize: '0.9rem',
    color: '#647179',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    width: '400px',
    borderRadius: '20px',
    padding: '2rem',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    marginTop: '1rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.25rem',
  },
  errorBox: {
    background: 'rgba(244, 63, 94, 0.15)',
    color: '#f43f5e',
    padding: '0.5rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
};
