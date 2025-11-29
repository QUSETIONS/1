import numpy as np
m = np.load("real_vessel_mask.npy")
print("mask shape:", m.shape)
print("unique values:", np.unique(m))
print("vessel ratio (%):", m.mean() * 100)
