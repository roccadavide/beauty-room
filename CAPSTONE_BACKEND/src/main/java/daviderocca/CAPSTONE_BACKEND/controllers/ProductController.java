package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.ProductResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewProductDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.ProductService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/products")
@Slf4j
public class ProductController {

    @Autowired
    private ProductService productService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public Page<ProductResponseDTO> getAllProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sort
    ) {
        log.info("Richiesta elenco prodotti - pagina: {}, size: {}, sort: {}", page, size, sort);
        return productService.findAllProducts(page, size, sort);
    }

    @GetMapping("/{productId}")
    @ResponseStatus(HttpStatus.OK)
    public ProductResponseDTO getProductById(@PathVariable UUID productId) {
        log.info("Richiesta dettaglio prodotto {}", productId);
        return productService.findProductByIdAndConvert(productId);
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping("/postProduct")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ProductResponseDTO createProduct(@Validated @RequestPart(value = "data") NewProductDTO payload,
                                            @RequestPart(value = "image", required = false) MultipartFile image,
                                            BindingResult bindingResult) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta creazione prodotto {}", payload.name());
        return productService.saveProduct(payload, image);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{productId}")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public ProductResponseDTO updateProduct(
            @PathVariable UUID productId,
            @Validated @RequestPart(value = "data") NewProductDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image,
            BindingResult bindingResult
    ) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta aggiornamento prodotto {}", productId);
        return productService.findProductByIdAndUpdate(productId, payload, image);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProduct(@PathVariable UUID productId) {
        log.info("Richiesta eliminazione prodotto {}", productId);
        productService.findProductByIdAndDelete(productId);
    }

}
