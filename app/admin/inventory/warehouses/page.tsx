"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Warehouse, RESOURCES, ACTIONS } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit } from "lucide-react";

export default function WarehousesPage() {
  const { hasPermission } = usePermissions();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    address: "",
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "warehouses"));
      const warehouseList: Warehouse[] = [];
      querySnapshot.forEach((doc) => {
        warehouseList.push({ id: doc.id, ...doc.data() } as Warehouse);
      });
      setWarehouses(warehouseList);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "warehouses"), {
        name: formData.name,
        address: formData.address || undefined,
        isActive: true,
        createdAt: Timestamp.now(),
      });
      setFormData({ name: "", address: "" });
      setShowCreateForm(false);
      fetchWarehouses();
    } catch (error) {
      console.error("Error creating warehouse:", error);
      alert("Failed to create warehouse");
    }
  };

  const handleToggleActive = async (warehouseId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "warehouses", warehouseId), {
        isActive: !currentStatus,
      });
      fetchWarehouses();
    } catch (error) {
      console.error("Error updating warehouse:", error);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setEditFormData({
      name: warehouse.name,
      address: warehouse.address || "",
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;

    try {
      await updateDoc(doc(db, "warehouses", editingWarehouse.id), {
        name: editFormData.name,
        address: editFormData.address || undefined,
        updatedAt: Timestamp.now(),
      });
      setEditingWarehouse(null);
      fetchWarehouses();
      alert("Warehouse updated successfully");
    } catch (error) {
      console.error("Error updating warehouse:", error);
      alert("Failed to update warehouse");
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.INVENTORY, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Warehouses</h1>
            <p className="text-gray-600 mt-2">Manage your warehouse locations</p>
          </div>
          {hasPermission("inventory", "create") && (
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          )}
        </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Warehouse Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Main Warehouse"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Warehouse address"
                  />
                </div>
                <div className="flex gap-4">
                  <Button type="submit">Create</Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Warehouse List</CardTitle>
            <CardDescription>All warehouses in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : warehouses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No warehouses found. Create your first warehouse to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.map((warehouse) => (
                      <TableRow key={warehouse.id}>
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell>{warehouse.address || "N/A"}</TableCell>
                        <TableCell>
                          <span
                            className={warehouse.isActive ? "text-green-600" : "text-gray-400"}
                          >
                            {warehouse.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {hasPermission("inventory", "update") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(warehouse)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            )}
                            {hasPermission("inventory", "update") && <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(warehouse.id, warehouse.isActive)}
                            >
                              {warehouse.isActive ? "Deactivate" : "Activate"}
                            </Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editingWarehouse !== null} onOpenChange={(open) => !open && setEditingWarehouse(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Warehouse</DialogTitle>
              <DialogDescription>Update warehouse information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Warehouse Name</Label>
                <Input
                  id="edit-name"
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                  placeholder="Main Warehouse"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Warehouse address"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingWarehouse(null)}>
                  Cancel
                </Button>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedRoute>
  );
}

