import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const createProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(3, "SKU must be at least 3 characters").toUpperCase(),
  category: z.string().min(2, "Category is required"),
  price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
});

type FormValues = z.infer<typeof createProductSchema>;

export default function CreateProduct() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();

  const form = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      price: undefined as unknown as number,
      stock: 0,
      lowStockThreshold: 5,
    },
  });

  const onSubmit = (data: FormValues) => {
    createProduct.mutate({ data }, {
      onSuccess: (product) => {
        toast.success("Product created successfully", {
          icon: <CheckCircle2 className="w-5 h-5 text-success" />
        });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setLocation(`/product?sku=${product.sku}`);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create product");
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b flex items-center gap-3 sticky top-0 bg-background z-10">
        <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">New Product</h1>
      </div>

      <div className="p-4 overflow-y-auto flex-1 pb-32">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="p-5 bg-card border rounded-2xl space-y-4">
              <div className="flex items-center gap-2 mb-2 text-primary font-bold">
                <Package className="w-5 h-5" />
                <h2>Basic Info</h2>
              </div>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Lego Classic Set" className="h-14 text-lg rounded-xl" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">SKU / Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. LGO-10283" className="h-14 text-lg rounded-xl font-mono uppercase" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} data-testid="input-sku" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Building Blocks" className="h-14 text-lg rounded-xl" {...field} data-testid="input-category" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-5 bg-card border rounded-2xl space-y-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Price (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-stock" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Alert At</FormLabel>
                      <FormControl>
                        <Input type="number" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-threshold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-16 text-lg font-black rounded-2xl shadow-xl active:scale-[0.98] transition-transform"
              disabled={createProduct.isPending}
              data-testid="button-submit"
            >
              {createProduct.isPending ? "Creating..." : "Save Product"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
